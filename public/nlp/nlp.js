(function($) {

window.poly = window.poly || {};

window.poly.markup = function (analyzed, text, markups, onToken) {
  text = text.toLowerCase();
  var remainder = text,
      curTextPos = 0,
      curMarkup = { start: -1 },
      curLabel = "",
      labels = [ "syntax", "colloc", "idiom", "idiom1", "idiom2" ];

  markupText(analyzed, "");
  closeMarkup();
 
  function markupText (treeNodes, label) {
    var i, j, treeNode, newLabel, newTreeNodes;
    for (i = 0; i < treeNodes.length; i++) {
      treeNode = treeNodes[i];
      if (!treeNode) continue;
      if (treeNode.token) {
        processToken(treeNode.token, label, treeNode.tag, treeNode.lemma, treeNode.grade);
      } else {
        for (j = 0; j < labels.length; j++) {
          newLabel = labels[j];
          newTreeNodes = treeNode[newLabel];
          if (newTreeNodes) {
            markupText(newTreeNodes, newLabel);
            break;
          }
        }
      }
    }
  }
  
  function processToken (token, label, tag, lemma, grade) {
    var pos, endPos;
    pos = remainder.indexOf(token.toLowerCase());
    if (pos == -1) return;
    curTextPos += pos;
    onToken(token, lemma, tag, grade, curTextPos);
    if (label != curLabel && curLabel != "" && curMarkup.start != -1) {
      closeMarkup();
    }
    if (label != curLabel && label != "") {
      curMarkup = { start: curTextPos, label: label };
    }
    curLabel = label;
    curTextPos += token.length;
    if (curMarkup.start != -1) {
      curMarkup.end = curTextPos - 1;
    }
    remainder = remainder.substring(pos + token.length);
  }
  
  function closeMarkup () {
    if (curMarkup.start != -1) {
      markups.push(curMarkup);
      curMarkup = { start: -1 };
    }
  }

};


window.poly.analyze = function (textNode, analyzed, success) {

  var maxTextLength = 2000,
      blockElements = [ "address", "article", "aside", "audio", "blockquote", "body", "canvas", "dd", "div", "dl", "fieldset",
        "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "noscript",
        "ol", "output", "p", "pre", "section", "table", "tr", "td", "tbody", "tfoot", "ul", "video", "li", "br"],
      i;

  function isBlockElement(node) {
    return node.nodeType == 1 && blockElements.indexOf(node.tagName.toLowerCase()) >= 0;
  }
 
  function collectTextNodes (node)
  {
    if (node.childNodes.length > 0)
        for (var i = 0; i < node.childNodes.length; i++)
            collectTextNodes(node.childNodes[i]);
    if (node.nodeType == Node.TEXT_NODE)
        textNodes.push(node);
  }

  window.poly.clearMultiSplits();

  var parentElem = textNode.nodeType == Node.TEXT_NODE ? textNode.parentElement : textNode;
  while (parentElem.parentElement && !isBlockElement(parentElem) && parentElem.textContent.length < maxTextLength) {
    parentElem = parentElem.parentElement;
  }
 
  window.poly.analyzedElement = parentElem;

  var textNodes = [],
      textNodesPos = [],
      text = "",
      markups = [];
  collectTextNodes(parentElem);
  for (i = 0; i < textNodes.length; i++) {
    textNodesPos.push(text.length);
    text += textNodes[i].textContent;
  }
 
  function onAnalyzed (data) {
    window.poly.analyzedTokens = [];
    window.poly.markup(data, text, markups, function (token, lemma, tag, grade, pos) {
      window.poly.analyzedTokens.push({ start: pos, tag: tag, lemma: lemma });
    });
    markupTextNodes();
    if (success) {
        success(data);
    }
  }
 
  if (analyzed) {
    onAnalyzed(analyzed);
  } else {
    $.ajax({
      type: "get",
      dataType: "json",
      url: "http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
      data: { phrase: text },
      success: onAnalyzed,
      error: function(request, status, error) {
        console.log("analyze request failed: "  + error);
      }
    });
  }
 
  function markupTextNodes () {
    var starts, lengths, styles, i, j, startNode, endNode, markup, endSpan, textNode, textNodeSpan;
    window.poly.multiSplits = [];
    for (i = 0; i < textNodes.length; i++) {
      starts = [];
      lengths = [];
      styles = [];
      textNode = textNodes[i];
      startNode = textNodesPos[i];
      endNode = startNode + textNode.length - 1;
      for (j = 0; j < markups.length; j++) {
        markup = markups[j];
        if (markup.start > endNode) break;
        if (markup.start >= startNode) {
          endSpan = markup.end;
          if (endSpan > endNode) {
            endSpan = endNode;
          }
          starts.push(markup.start - startNode);
          lengths.push(endSpan - markup.start + 1);
          styles.push("poly-" + markup.label);
        }
      }
      if (starts.length != 0) {
        window.poly.multiSplits.push(window.poly.multiSplitTextNode(textNode, starts, lengths, styles));
      }
    }
  }
 
};

window.poly.translate = function (phrase, success) {
  var styles = [ "poly-colloc", "poly-idiom" ],
      tags = "",
      tag = "",
      lemma = "",
      word = "",
      $phrase = $(phrase),
      outOfVocab = $phrase.hasClass("poly-out-of-vocab"),
      i, $elem, textPos, token, goOn;

  var langTo = "es";
  switch (window.poly.lang) { // tbd
    case "en":
      langTo = "es";
      break;
    case "sv":
      langTo = "en";
      break;
  }
 
  function textPosInNode (span, node, nodeTextPos) {
    if (node.nodeType == Node.TEXT_NODE)
      nodeTextPos += node.textContent.length;
    var done = false;
    for (var i = 0; !done && i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child == span) {
        done = true;
        break;
      }
      var res = textPosInNode(span, child, 0);
      done = res.done;
      nodeTextPos += res.pos;
    }
    return { pos: nodeTextPos, done: done };
  }
 
  if (window.poly.analyzedElement && window.poly.selection) {
    textPos = textPosInNode(window.poly.selection.span, window.poly.analyzedElement, 0).pos;
    for (i = 0; i < window.poly.analyzedTokens.length; i++) {
      token = window.poly.analyzedTokens[i];
      if (token.start >= textPos) {
        tags = token.tag;
        lemma = token.lemma;
        tag = (tags[0] == " " ? tags.substring(1, 3) : tags);
        break;
      }
    }
  }
 
  goOn = true;
  for (i = 0; goOn && i < styles.length; i++) {
    $elem = $phrase.closest("." + styles[i]);
    if ($elem.length != 0) {
      phrase = $elem.text();
      goOn = false;
    }
  }
  if (goOn) {
    $elem = $phrase.closest("poly-idiom1");
    if ($elem.length != 0) {
      phrase = $elem.text();
      for (; !$elem.hasClass("poly-idiom2") && $elem.length != 0; $elem = $elem.next());
      if ($elem.length != 0) {
        phrase = phrase + " " + $elem.text();
      }
    } else {
      $elem = $phrase.closest("poly-idiom2");
      if ($elem.length != 0) {
        phrase = $elem.text();
        for (; !$elem.hasClass("poly-idiom1") && $elem.length != 0; $elem = $elem.prev());
        if ($elem.length != 0) {
          phrase = $elem.text() + " " + phrase;
        }
      } else {
        phrase = "";
      }
    }
  }
 
  if (window.poly.lang == "sv") {
    // compound word split
    if (!tag) {
      tag = "NN";
    }
    word = window.poly.selection.span.textContent;
    if (!lemma) {
      lemma = word.toLowerCase();;
    }
    analyzeCompound(lemma, tag, function (data) {
      translatePhrase(data, tag, langTo, function (lemma, pos, trg) {
        success(lemma, pos, trg);
      });
    });
    return;
  }
 
  if (!phrase && !lemma) return;

  translatePhrase("", tag, langTo, function (trg) {
    success(trg);
  });
 
  function translatePhrase (compound, pos, to, continuation) {
    window.poly.currentLemma = (outOfVocab ? "" : (!pos ? lemma : lemma + "|" + pos));
    $.ajax({
      type: "get",
      dataType: "text",
      url: "http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
      data: { phrase: phrase, word: word, lemma: lemma, compound: compound, pos: pos, to: langTo },
      success: function (data) {
        data = data.trim();
        continuation(lemma, pos, data);
      },
      error: function(request, status, error) {
        console.log("translate request failed: "  + error);
      }
    });
  }
 
  function analyzeCompound (compound, pos, continuation) {
    $.ajax({
      type: "get",
      dataType: "text",
      url: "http://savvy-apps.com:3000",
      data: { word: compound, pos: pos },
      success: function (data) {
        continuation(data.trim());
      },
      error: function(request, status, error) {
        console.log("analyze compound request failed: "  + error);
        continuation("");
      }
    });
  }
 
 
};

})(jQuery);
