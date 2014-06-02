(function($) {

window.poly = window.poly || {};

window.poly.libraryBooks = [];
window.poly.newBookList = [];
window.poly.bookmarks = [];
window.poly.words = [];

function funcStub () {
}

// From native to JS

window.poly.getToc = function () {
  return JSON.stringify(window.poly.toc);
};

window.poly.goto = function (url) {
  window.poly.currentBook.goto(url);
};

window.poly.getCurrentUrl = function () {
  // eis TBD: last part of url can be non-unique. change the way it is searched for in METableViewController
  var book = window.poly.currentBook;
  if (!book) return "";
  var url = ((book.spine[book.spinePos] || {}).href) || "";
  if (url.indexOf("/") == -1) return "";
  return url.substring(url.lastIndexOf("/") + 1);
};

window.poly.getLibraryBooks = function () {
  return JSON.stringify(window.poly.libraryBooks);
};

window.poly.deleteBooks = function (books) {
  window.phonegap.utils.init(function () {
    for (var i = window.poly.libraryBooks.length - 1; i >= 0; i--) {
      var book = window.poly.libraryBooks[i];
      if (books.indexOf(book.folderName) != -1) {
        window.poly.libraryBooks.splice(i, 1);
        window.phonegap.utils.removeDirectory(book.folderPath, funcStub);
        window.poly.clearLocalStorage(book);
      }
      if (i == 0) {
        window.poly.native.reloadLibrary();
      }
    }
  });
};

window.poly.clearLocalStorage = function (book) {
  var keys = [
    "/:poly:bookmarks",
    "/:poly:spinePages",
    "/:poly:toc",
    "/:poly:lang",
    "/:poly:optimized",
    "/:1",
    "/:contents:1"
  ];
  for (var j = 0; j < keys.length; j++) {
    localStorage.removeItem(book.folderPath + keys[j]);
  }
};

window.poly.getBookmark = function () {
  var book = window.poly.currentBook;
  if (!book) return "";
  return book.getCurrentLocationCfi();
};

window.poly.bookmarkExists = function () {
  var book = window.poly.currentBook;
  if (!book) return false;
  for (var i = 0; i < window.poly.bookmarks.length; i++) {
    var bmk = window.poly.bookmarks[i].value;
    var page = book.getPageByCfi(bmk);
    if (page == book.render.chapterPos) return true;
  }
  return false;
};

window.poly.bookKey = function () {
  var book = window.poly.currentBook;
  if (!book) return "";
  return book.settings.bookPath + ":poly";
};

window.poly.toggleBookmark = function () {
  var book = window.poly.currentBook,
      bmk, page;
  if (!book) return;
  var removed = false;
  for (var i = window.poly.bookmarks.length - 1; i >= 0; i--) {
    bmk = window.poly.bookmarks[i].value;
    page = book.getPageByCfi(bmk);
    if (page == book.render.chapterPos) {
      window.poly.bookmarks.splice(i, 1);
      removed = true;
    }
  }
  if (!removed) {
    bmk = window.poly.getBookmark();
    if (bmk) {
      window.poly.bookmarks.push({ value: bmk, text: (new Date).toLocaleDateString() });
    }
  }
  var bookKey = window.poly.bookKey() + ":bookmarks";
  localStorage.setItem(bookKey, JSON.stringify(window.poly.bookmarks));
};

window.poly.getBookmarks = function () {
  return JSON.stringify(window.poly.bookmarks);
};

window.poly.gotoBookmark = function (bmk) {
  var book = window.poly.currentBook;
  if (!book) return;
  window.poly.clearSelection();
  book.displayChapter(bmk);
};

window.poly.getWords = function () {
  return JSON.stringify(window.poly.words);
};

window.poly.saveSettings = function () {
  var book = window.poly.currentBook;
  if (book) {
    book.saveSettings();
  }
};

window.poly.unload = function () {
  var book = window.poly.currentBook;
  if (book) {
    book.unload();
    localStorage.removeItem("poly:currentBook"); 
  }
};

window.poly.splitTextNode = function (textNode, start, length, style) {
  var $iframe = $("iframe"),
      doc = $iframe.length == 0 ? document : $iframe[0].contentDocument,
      end = start + length > textNode.textContent.length ? textNode.textContent.length : start + length,
      word = textNode.splitText(start),
      remStart = end - start + 1,
      remainder = remStart >= word.textContent.length ? null : word.splitText(remStart),
      span = doc.createElement("span");
  textNode.parentNode.insertBefore(span, word);
  span.insertBefore(word, null);
  $(span).addClass(style);
  return { textNode: textNode, span: span, remainder: remainder };
};

window.poly.undoSplitTextNode = function (textNode, span, remainder) {
  textNode.textContent = textNode.textContent + span.textContent + (remainder ? remainder.textContent : "");
  textNode.parentNode.removeChild(span);
  if (remainder) {
    textNode.parentNode.removeChild(remainder);
  }
};

window.poly.multiSplitTextNode = function (textNode, starts, lengths, styles) {
  var splits = [];
 
  function doSplit (textNode, starts, lengths, styles) {
    if (starts.length == 0) return;
    var split = window.poly.splitTextNode(textNode, starts[0], lengths[0] - 1, styles[0]);
    splits.push(split);
    for (var i = 1; i < starts.length; i++) {
      starts[i] -= (starts[0] + lengths[0]);
    }
    starts.shift();
    lengths.shift();
    styles.shift();
    doSplit(split.remainder, starts, lengths, styles);
  }
 
  doSplit(textNode, starts.slice(0), lengths.slice(0), styles.slice(0));
  return splits;
};

window.poly.undoMultiSplitTextNode = function (splits) {
  for (var i = splits.length - 1; i >= 0; i--) {
    var split = splits[i];
    window.poly.undoSplitTextNode(split.textNode, split.span, split.remainder);
  }
};

window.poly.clearMultiSplits = function () {
  window.poly.analyzedElement = null;
  var splits = window.poly.multiSplits;
  if (!splits) return;
  for (var i = 0; i < splits.length; i++) {
    window.poly.undoMultiSplitTextNode(splits[i]);
  }
  window.poly.multiSplits = null;
};

window.poly.selectTextPos = function (textNode, start, length) {
  var split = window.poly.splitTextNode(textNode, start, length, "poly-highlight");
  window.poly.selection = { textNode: textNode, span: split.span, remainder: split.remainder };
  return $(split.span).text();
};

window.poly.clearSelection = function (preserveAnalyzed) {
  var sel = window.poly.selection;
  if (sel) {
    window.poly.undoSplitTextNode(sel.textNode, sel.span, sel.remainder);
  }
  window.poly.selection = null;
  if (!preserveAnalyzed) {
    window.poly.clearMultiSplits();
  }
};

window.poly.ensureHtmlUrl = function (url) {
  // avoid loading .xml in iframe, rename .xml files to .html
  // to work around an iOS Safari bug (observed in iOS 7.0.3): for elements created after loading a document from an .xml file into iframe (just because of the extension, even if mime is xhtml), class and style don't have any effect, appearance is always inherited from the container, so we can't highlight
  var deferred = new RSVP.defer(),
      parts = url.split("/"),
      fileName = parts[parts.length - 1],
      origFileName = fileName;
  parts.pop();
  var path = parts.join("/");
  parts = fileName.split(".");
  if (parts.length < 2) return url;
  var ext = parts[parts.length - 1];
  if (ext == "html") return url;
  parts.pop();
  fileName = parts.join(".");
  var newName = fileName + "-poly.html";
  window.phonegap.utils.init(function () {
    window.phonegap.utils.renameFile(path, origFileName, newName, function () {
      deferred.resolve(path + "/" + newName);
    }, function () {
      deferred.resolve(url);
    });
  });
  return deferred.promise;
};

window.poly.gotoTextPos = function (textPos) {
  var book = window.poly.currentBook;
  if (!book) return;
  window.poly.clearSelection();
  var parts = textPos.split("\t"),
      textPos = parts[0],
      pageCfi = parts[1],
      pos = textPos.lastIndexOf("!"),
      length = +textPos.substring(pos + 1),
      cfi = textPos.substring(0, pos);
  book.displayChapter(cfi).then(function () {
    var nodePos = book.getTextByCfi(cfi);
    if (!nodePos) return;
    if (pageCfi) {
      book.render.gotoCfiFragment(pageCfi);
    }
    window.poly.selectTextPos(nodePos.node, nodePos.offset, length);
  });
};

window.poly.backButton = function () {
  if (window.poly.onBackButton) {
    window.poly.onBackButton();
  }
};

window.poly.setDifficulty = function (difficulty) {
  var word = window.poly.currentLemma,
      user = window.poly.user;
  if (!word || !user) return;
  $.post("http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
    { user: user, word: word, difficulty: difficulty},
    function () {
    
      function changeData (data) {
        if (!data) return;
        delete data.known[word];
        for (var i = 0; i < data.learn.length; i++) {
          delete data.learn[i][word];
        }
        if (difficulty == 0) {
          data.known[word] = 0;
        } else if (difficulty <= data.learn.length) {
          data.learn[difficulty - 1][word] = 0;
        }
      }
      
      changeData(window.poly.userDataForArticle);
      changeData(window.poly.userDataForTopics);
      window.poly.afterWordPopup();
    }
  );
};

window.poly.nextArticleButton = function () {
  $.ajax({
    type: "get",
    dataType: "text",
    url: "http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
    data: { user: window.poly.user, getNextArticle: 0 },
    success: function (data) {
      if (data) {
        window.poly.openArticle(data);
      } else {
        window.poly.native.alert("Server cannot suggest next article for reading");
      }
    },
    error: function(request, status, error) {
      console.log("getNextArticle request failed: "  + error);
    }
  });
};

window.poly.setWebDict = function (key, dictNum, url, srcId) {
  localStorage.setItem("webDict-" + key + dictNum, srcId + "|" + url);
};

window.poly.getWebDict = function (key, dictNum) {
  return localStorage.getItem("webDict-" + key + dictNum);
};

window.poly.saveWebDictWord = function (orig, trans, pos, langTo) {
  $.post("http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
    { word: orig, trans: trans, pos: pos, to: langTo },
    function () {
      window.poly.native.alert("Translation/definition saved in dictionary");
    }
  );
};

window.poly.getDictImage = function (imgNum, lemma, pos) {
  $.ajax({
    type: "get",
    dataType: "text",
    url: "http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
    data: { imgNum: imgNum, lemma: lemma, pos: pos },
    success: function (data) {
      var imgUrl = "",
          imgCount = 0,
          imgNum = -1,
          imgWidth = 0,
          imgHeight = 0;
      if (data) {
        data = data.split("|");
        imgCount = +data[0];
        imgNum = +data[1];
        imgWidth = +data[2];
        imgHeight = +data[3];
        imgUrl = data[4];
      }
      window.poly.native.showImage(imgUrl, imgCount, imgNum, imgWidth, imgHeight, lemma, pos);
    },
    error: function(request, status, error) {
      console.log("dictionary image request failed: "  + error);
    }
  });
};

window.poly.putDictImage = function (word, pos, img) {
  $.post("http://savvy-apps.com:3001/PolyNLP/analyze-" + window.poly.lang,
    { word: word, pos: pos, img: img }
  );
};


// From JS to native

window.poly.native = window.poly.native || {};

window.poly.native.getDocumentDir = function(success) {
  cordova.exec(function (res) {
    success && success(res);
  }, funcStub, "ME", "getDocumentsDir", []);
};

window.poly.native.extract = function(success, file, destination) {
  cordova.exec(success, funcStub, "ME", "extract", [file, destination]);
};

window.poly.native.openBook = function(bookDir, lang) {
  if (bookDir[bookDir.length - 1] != "/") {
    bookDir += "/";
  }
  if (window.poly.currentBook) {
    window.poly.currentBook.unload();
  }
  cordova.exec(funcStub, funcStub, "ME", "openBook", [bookDir, lang]);
};

window.poly.native.getBookDir = function(success) {
  cordova.exec(function (res) {
    success && success(res);
  }, funcStub, "ME", "getBookDir", []);
};

window.poly.native.getBookLang = function(success) {
  cordova.exec(function (res) {
    success && success(res);
  }, funcStub, "ME", "getBookLang", []);
};

window.poly.native.getWindowWidth = function(success) {
  cordova.exec(function (res) {
    success && success(res);
  }, funcStub, "ME", "getWindowWidth", []);
};

window.poly.native.getWindowHeight = function(success) {
  cordova.exec(function (res) {
    success && success(res);
  }, funcStub, "ME", "getWindowHeight", []);
};

window.poly.native.reloadLibrary = function(success) {
  cordova.exec(function (res) {
    success && success(res);
  }, funcStub, "ME", "reloadLibrary", []);
};

window.poly.native.updateBookmarkState = function(isBmk) {
  cordova.exec(funcStub, funcStub, "ME", "updateBookmarkState", [isBmk]);
};

window.poly.native.dictPopup = function(lemma, pos, msg) {
  cordova.exec(funcStub, funcStub, "ME", "dictPopup", [lemma, pos, msg]);
};

window.poly.native.alert = function(msg) {
  cordova.exec(funcStub, funcStub, "ME", "alert", [msg]);
};

window.poly.native.wordPopup = function(msg) {
  if (!window.cordova) {
      $("#dictPanel").show();
      msg = msg.replace(/\n/g, "<br/>");
      $("#dictPanel .panel-body").html(msg);
      return;
  }
  cordova.exec(funcStub, funcStub, "ME", "wordPopup", [msg]);
};

window.poly.native.authenticate = function (url) {
  cordova.exec(funcStub, funcStub, "ME", "authenticate", [url]);
};

window.poly.native.showImage = function (imgUrl, imgCount, imgNum, imgWidth, imgHeight, lemma, pos) {
  cordova.exec(funcStub, funcStub, "ME", "showImage", [imgUrl, imgCount, imgNum, imgWidth, imgHeight, lemma, pos]);
}

})(jQuery);




