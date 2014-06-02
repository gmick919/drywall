/* global app:true, io:false */

var socket;

(function() {
    'use strict';

$(function () {

    window.poly.analyzedArticle = [];
    window.poly.handleArticleEvents('#chatBox');

    $('#dictPanel').drags();
    $('#closeDictPanel').click(function() {
        $("#dictPanel").hide();
    });

    var addChatMessage = function(data) {
        var block = $('<div class="poly-block"/>').appendTo('#chatBox').text(data);
        $("#chatBox").animate({ scrollTop: $('#chatBox')[0].scrollHeight}, 500);
        window.poly.analyze(block[0], null, function (analyzed) {
            window.poly.analyzedArticle.push(analyzed);
        });
    };

    socket = io.connect();
    socket.on('connect', function() {
        socket.emit('/about/#join');
        addChatMessage('you joined the chat room');
    });
    socket.on('/about/#newVisitor', function(visitor) {
        addChatMessage(visitor +': joined');
    });
    socket.on('/about/#incoming', function(visitor, message) {
        addChatMessage(visitor +': '+ message);
    });

    app = app || {};

    app.ChatForm = Backbone.View.extend({
        el: '#chatForm',
        template: _.template( $('#tmpl-chatForm').html() ),
        events: {
            'submit form': 'preventSubmit',
            'click .btn-chat': 'chat'
        },
        initialize: function() {
            this.render();
        },
        render: function() {
            this.$el.html(this.template());
        },
        preventSubmit: function(event) {
            event.preventDefault();
        },
        chat: function() {
            var newMessage = this.$el.find('[name="message"]').val();
            if (newMessage) {
                addChatMessage('me : '+ newMessage);
                socket.emit('/about/#send', newMessage);
                this.$el.find('[name="message"]').val('');
            }
        }
    });

    $(document).ready(function() {
        app.chatForm = new app.ChatForm();
    });
});

}());
