---
layout: page
title: "Reliable by Design: building trustworthy LLM-powered developer tools"
description: "A series on building LLM-powered developer tools that return reliable answers on production codebases, covering retrieval, orchestration, and verification."
permalink: /series/reliable-by-design/
---

{% assign series = site.data.series | where: "name", "Reliable by Design" | first %}

{{ series.description }}

The articles build a single architecture from the ground up. Read them in order
for the full picture, or jump to the component you are working on.

<ol class="series-hub-list">
{% for article in series.articles %}
  {% if article.url and article.url != "" %}
  <li><a href="{{ article.url }}">{{ article.title }}</a></li>
  {% else %}
  <li class="series-item--upcoming">{{ article.title }} <em>(coming soon)</em></li>
  {% endif %}
{% endfor %}
</ol>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "{{ series.name | escape }}",
  "description": "{{ series.description | escape }}",
  "itemListElement": [
    {% assign published = "" | split: "" %}
    {% for article in series.articles %}{% if article.url and article.url != "" %}{% assign published = published | push: article %}{% endif %}{% endfor %}
    {% for article in published %}
    {
      "@type": "ListItem",
      "position": {{ forloop.index }},
      "url": "{{ article.url | absolute_url }}",
      "name": "{{ article.title | escape }}"
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]
}
</script>
