/**
 * Main JS file for Horace behaviours
 */
(function ($) {
	"use strict";

	var $body = $('body');

	$(document).ready(function(){

		// Responsive video embeds
		$('.post-content').fitVids();

		// Scroll to top
		$('#top-button').on('click', function(e) {
			$('html, body').animate({
				'scrollTop': 0
			});
			e.preventDefault();
		});
		
		// Sidebar
		$('#sidebar-show, #sidebar-hide').on('click', function(e){
			$body.toggleClass('sidebar--opened');
			$(this).blur();
			e.preventDefault();
		});
		$('#site-overlay').on('click', function(e){
			$body.removeClass('sidebar--opened');
			e.preventDefault();
		});

		// Show comments
		var interval = setInterval(function() {
			var disqusHeight = $('#disqus_thread').height();
			if ( disqusHeight > 100 ) {
				$('#comments-area').addClass('comments--loaded');
				clearInterval(interval);
			}
		}, 100);
		$('#comments-overlay, #comments-show').on('click', function(e){
			$('#comments-area').removeClass('comments--loaded').addClass('comments--opened');
			e.preventDefault();
		});

		// Reading progress bar
		var progressBar = document.getElementById('reading-progress');
		if (progressBar) {
			window.addEventListener('scroll', function () {
				var scrolled = window.scrollY;
				var total = document.documentElement.scrollHeight - window.innerHeight;
				progressBar.style.width = (total > 0 ? (scrolled / total * 100) : 0) + '%';
			});
		}

	});

}(jQuery));

// Table of contents
document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('toc-enabled')) return;
    var headings = document.querySelectorAll('.post-content h2');
    if (headings.length < 2) return;
    var toc = document.createElement('nav');
    toc.className = 'toc';
    var title = document.createElement('p');
    title.className = 'toc-title';
    title.textContent = 'In this article';
    var list = document.createElement('ol');
    list.className = 'toc-list';
    headings.forEach(function (heading) {
        var item = document.createElement('li');
        var link = document.createElement('a');
        link.href = '#' + heading.id;
        link.textContent = heading.textContent;
        item.appendChild(link);
        list.appendChild(item);
    });
    toc.appendChild(title);
    toc.appendChild(list);
    var postContent = document.querySelector('.post-content');
    if (postContent) postContent.insertBefore(toc, postContent.firstChild);
});

// Copy-to-clipboard buttons for code blocks
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('pre > code').forEach(function (codeBlock) {
        var button = document.createElement('button');
        button.className = 'copy-btn';
        button.textContent = 'Copy';
        var pre = codeBlock.parentNode;
        pre.appendChild(button);
        button.addEventListener('click', function () {
            navigator.clipboard.writeText(codeBlock.innerText).then(function () {
                button.textContent = 'Copied!';
                setTimeout(function () { button.textContent = 'Copy'; }, 1500);
            });
        });
    });
});
