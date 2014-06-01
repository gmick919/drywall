(function($) {

window.poly = window.poly || {};
 
$(function () {

  window.poly.lang = "sv"; //TBD
  window.poly.langLevel = 1; //TBD
  window.poly.langLevelCount = 6; //TBD
  window.poly.user = "misha"; //TBD
  
  window.poly.markupText = function (analyzed, para, data, plainText, isTopic) {
    if (!analyzed || !para || !data) return;
  
    function findTextNodeAndPos (para, posInPara) {
      var curPos = 0,
          lastNode = null,
          foundPos = -1;

      function visitNode (node) {
        var lgth = node.textContent.length;
        if (foundPos != -1 || lgth == 0) return;
        if (node.nodeType == Node.TEXT_NODE) {
          lastNode = node;
          if (curPos + lgth > posInPara) {
            foundPos = posInPara - curPos;
          }
          curPos += lgth;
          return;
        }
        if (node.hasChildNodes()) {
          for (var i = 0; i < node.childNodes.length; i++) {
            var child = node.childNodes[i];
            visitNode(child);
          }
        }
      }
  
      visitNode(para);
      return { node: lastNode, pos: foundPos };
    }
  
    var $para = $(para),
        text = $para.text(),
        html = "",
        curTextPos = 0,
        changed = false;
  
    window.poly.markup(analyzed, text, [], function (token, lemma, tag, grade, pos) {
      var style = "",
          parts = tag.split(" ");
      if (parts.length >= 2) {
        tag = parts[1];
      }
      if (!lemma) {
        lemma = token.toLowerCase();
      }
      var key = lemma + "|" + tag;
      var altKey = " " + lemma + "-" + (tag == "NN" ? "n" : (tag == "VB" ? "v" : (tag == "JJ" ? "adj" : (tag == "AB" ? "adv" : "")))) + " ";
      if (!isTopic && window.poly.topicTokens && window.poly.topicTokens.indexOf(altKey) != -1 && data.known[key] == null) {
        style = "poly-topic-word";
      } else if (grade == -1 && token.length > 1) {
        style = "poly-out-of-vocab";
      }
      for (var i = 0; !style && i < data.learn.length; i++) {
        if (data.learn[i][key] != null) {
          style = "poly-learn-" + (i + 1);
        }
      }
      if (!style && grade == window.poly.langLevel && data.known[key] == null) {
        style = "poly-unknown";
      }
      if (!style && token.length > 1) {
        if (grade == null || grade >= window.poly.langLevel + (window.poly.langLevelCount - window.poly.langLevel)/2) {
          style = "poly-very-rare";
        } else if (grade > window.poly.langLevel) {
          style = "poly-rare";
        }
      }
      if (plainText) {
        if (pos > curTextPos) {
          html += htmlEscape(text.substring(curTextPos, pos));
        }
        if (style) {
          html += '<span class="' + style + '">';
        }
        html += htmlEscape(token);
        if (style) {
          changed = true;
          html += '</span>';
        }
      } else {
        var found = findTextNodeAndPos(para, pos);
        if (found.pos >= 0) {
          window.poly.splitTextNode(found.node, found.pos, token.length - 1, style);
        }
      }
      curTextPos = pos + token.length;
    });
  
    if (text.length > curTextPos) {
        html += htmlEscape(text.substring(curTextPos));
    }
    if (changed) {
      $para.html(html);
    }
  };
 
  function htmlEscape (text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  }

window.poly.handleArticleEvents = function (container) {
  function textNodeInAnalyzedArea (node) {
    for (parent = node.parentElement; parent != null; parent = parent.parentElement) {
      if (parent == window.poly.analyzedElement) {
        return true;;
      }
    }
    return false;
  }

  document.body.addEventListener(window.poly.touch ? "touchstart" : "mousedown", function (e) {
    if (!$(container).is(":visible")) return;
    var x = e.pageX,
        y = e.pageY - $(window).scrollTop(),
        caretRangeFn = document.caretRangeFromPoint || function (x, y) {
            var range = document.caretPositionFromPoint(x, y);
            return { startContainer: range.offsetNode, startOffset: range.offset };
        };
        range = caretRangeFn.call(document, x, y),
        textNode = range && (range.startContainer || range.offsetNode),
        analyzed = textNode && textNode.nodeType == 3 && textNodeInAnalyzedArea(textNode);
    // TODO: IE support
    range = caretRangeFn.call(document, x, y);
    window.poly.touchRange = null;
    if (window.poly.selection && range && window.poly.selection.span == range.startContainer.parentNode) return;
    if (!analyzed) {
      window.poly.selection = null;
      window.poly.multiSplits = null;
      var blockNum = window.poly.activeBlock;
      if (blockNum != null) {
        var block = $(".poly-block")[blockNum];
        if (block) {
          window.poly.markupText(window.poly.analyzedArticle[blockNum], block, window.poly.userDataForArticle, true, false);
        }
        window.poly.activeBlock = null;
      }
    }
    window.poly.clearSelection(analyzed);
    range = caretRangeFn.call(document, x, y);
    window.poly.touchRange = range;
    document.body.style.webkitUserSelect = "none";
  }, false);
  document.body.addEventListener(window.poly.touch ? "touchmove" : "mousemove", function (e) {
    window.poly.touchRange = null;
    document.body.style.webkitUserSelect = "inherit";
  }, false);
  document.body.addEventListener("touchcancel", function (e) {
    window.poly.touchRange = null;
    document.body.style.webkitUserSelect = "inherit";
  }, false);
  document.body.addEventListener(window.poly.touch ? "touchend" : "mouseup", function (e) {
    if (!$(container).is(":visible")) return;
    var range = window.poly.touchRange;
    document.body.style.webkitUserSelect = "inherit";
    if (range == null) return;
    var textNode = range.startContainer;
    if (textNode.nodeType != 3) return;
            
    function wordBorder (c) {
      return "!?&()§:;\",./|\\ ".indexOf(c) != -1;
    }
            
    var start = range.startOffset,
        end = start,
        text = textNode.textContent,
        i;
    for (i = start - 1; i >= 0; i--) {
      if (wordBorder(text[i])) break;
      start = i;
    }
    for (i = start; i <= text.length; i++) {
      if (wordBorder(text[i])) break;
      end = i;
    }
    
    var analyzed = textNodeInAnalyzedArea(textNode);
    if (!analyzed) {
      var block = $(textNode.parentElement).closest(".poly-block"),
          blockNum = block.prevAll(".poly-block").length;
      if (!block[0]) return;
      analyzed = window.poly.analyzedArticle[blockNum];
      block.html(block.text());
      window.poly.analyze(block[0], analyzed);
      window.poly.markupText(analyzed, block[0], window.poly.userDataForArticle, false, false);
      window.poly.activeBlock = blockNum;
      return;
    }

    var nodeToTranslate = !analyzed ? null : textNode;
            
    var selWord = window.poly.selectTextPos(textNode, start, end - start);

    if (nodeToTranslate && selWord) {
      window.poly.translate(nodeToTranslate.parentElement, function (lemma, pos, translation) {
      
        window.poly.afterWordPopup = function () {
          $(".poly-block").each(function (i, para) {
            var analyzed = window.poly.analyzedArticle[i],
                active = i == window.poly.activeBlock;
            if (active) {
              $(para).html($(para).text());
              window.poly.selection = null;
              window.poly.multiSplits = null;
              window.poly.analyze(para, analyzed);
            }
            window.poly.markupText(analyzed, para, window.poly.userDataForArticle, !active, false);
          });
        }
        
        if (window.poly.currentLemma) {
          window.poly.native.wordPopup(translation.replace("|", "\n* "));
        } else {
          window.poly.native.dictPopup(lemma, pos, translation.replace("|", "\n* "));
        }
      });
    }
            
  }, false);
  
};

});

})(jQuery);