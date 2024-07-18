---
layout: post
title:  "🤥Pinokio URL Shortener Design and Implementation: A Hands-On Solution Architecture (Part 1)"
tags: [ Architecture, AWS, Java, Spring Boot ]
featured_image_thumbnail: assets/images/posts/pinokio/pinokio1_thumbnail.webp
featured_image: assets/images/posts/pinokio/pinokio1.webp
---

In this series of articles, we will design and implement a complete URL shortener service called Pinokio. 
We will design the architecture, discuss the decisions made, compare different architectural solutions, 
and implement the system using the Java programming language and the Spring Boot framework. 
As part of this series, we will analyze the complexity of each architectural solution and the associated costs.

<!--more-->

> "If you can’t build the thing you’re designing, you shouldn’t be designing it." <cite>- Simon Brown -</cite>

Our final system will consist of:

* A modular monolithic platform. We will explain the pros and cons of this domain model and why it suits our requirements best.
* CI/CD via GitHub Actions for continuous deployment.
* AWS EC2 instances in Docker Swarm mode with an Auto Scaling group for scaling worker nodes.
* AWS DynamoDB as our persistent storage.
* AWS CloudFront for caching the redirection of short URLs to the original URLs at edge locations closer to the user.
* AWS API Gateway with rate limiting support and SSL termination.
* Environment automation using AWS CloudFormation.
* Automated distributed performance testing using Gatling and EC2.

Our final system will be highly available, fault-tolerant, and scalable.

In each part, the relevant AWS stack will be provided to you to quickly set up the infrastructure.

**Please note that you might incur some charges if you choose to execute the AWS stack yourself.** 
Alternatively, you can follow along to learn and potentially take advantage of the AWS Free Tier by deploying fewer resources.

## Acceptance Criteria

* URL Shortening:
  1. The system should shorten a long URL to a shorter one. 
  2. The shortened URL should be 8 characters long. 
  3. If the long URL is less than or equal to 8 characters, no transformation should be applied.
  4. For the same long URL, the system will be generating different short URLs to enable in the future the ability to track statistics for each short URL.
* Redirection:
  1. When a short URL is invoked via a GET request, a 301 redirect should be returned, redirecting to the long URL.
  2. The system should not track statistics for redirections to maintain simplicity in the business logic in the first version.
* Expiry and Deletion:
  1. By default, the short URL should expire after 3 months.
  2. Users should have the ability to delete a short URL manually before the expiry date. 
* The system should be able to handle 20 million URLs generated per day.
* Infrastructure:
  1. Use AWS services such as EC2, DynamoDB, API Gateway, ALB, and CloudFront for scaling and load distribution.
  2. Docker Swarm will be used to manage containers across EC2 instances.
* High availability setup will include at least 3 manager nodes for Docker Swarm and multiple worker nodes.
* Security: API Gateway will handle SSL termination.
* Short URLs will be unguessable to prevent enumeration attacks.
* Caching: Use CloudFront to cache GET requests and reduce the load on backend services.

## What We Will Learn from This Series

We will learn how to design an efficient, highly available, and scalable system using best practices around system design and cloud infrastructure. We will explore various AWS services, understand their pros and cons, and learn how to leverage them to build a system of this scale.

Stay tuned for future articles.


