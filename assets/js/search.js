var searchIndex = null;
var searchData = null;

function buildIndex(data) {
    searchData = data;
    searchIndex = lunr(function () {
        this.ref('url');
        this.field('title', { boost: 10 });
        this.field('tags', { boost: 5 });
        this.field('content');
        data.forEach(function (post) {
            this.add({
                url: post.url,
                title: post.title,
                tags: post.tags.join(' '),
                content: post.content
            });
        }, this);
    });
}

function runSearch(query) {
    var resultsEl = document.getElementById('search-results');
    if (!query || query.length < 2) {
        resultsEl.innerHTML = '';
        return;
    }
    if (!searchIndex) {
        resultsEl.innerHTML = '<p class="search-no-results">Loading index…</p>';
        return;
    }
    var results;
    try {
        results = searchIndex.search(query);
    } catch (e) {
        results = searchIndex.search(query + '*');
    }
    if (results.length === 0) {
        resultsEl.innerHTML = '<p class="search-no-results">No results for &ldquo;' + query + '&rdquo;.</p>';
        return;
    }
    resultsEl.innerHTML = results.map(function (r) {
        var post = searchData.find(function (p) { return p.url === r.ref; });
        var tags = post.tags.map(function (t) {
            return '<a href="/tags/index.html#' + encodeURIComponent(t) + '">' + t + '</a>';
        }).join(' ');
        return '<article class="search-result">'
            + '<h2 class="post-title"><a href="' + post.url + '">' + post.title + '</a></h2>'
            + '<p class="post-meta">' + post.date + '</p>'
            + '<p class="post-tags">' + tags + '</p>'
            + '</article>';
    }).join('');
}

document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('search-input');
    if (!input) return;

    // Pre-fill from URL query param
    var params = new URLSearchParams(window.location.search);
    var initial = params.get('q') || '';
    if (initial) input.value = initial;

    fetch('/search.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            buildIndex(data);
            if (initial) runSearch(initial);
        });

    input.addEventListener('input', function () {
        runSearch(this.value.trim());
    });
});
