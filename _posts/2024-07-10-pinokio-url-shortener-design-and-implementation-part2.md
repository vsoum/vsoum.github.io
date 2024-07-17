---
layout: post
title:  "🤥Pinokio URL Shortener Design and Implementation: A Hands-On Solution Architecture (Part 2)"
tags: [ Architecture, AWS, Java, Spring Boot ]
featured_image_thumbnail: assets/images/posts/pinokio/pinokio1_thumbnail.webp
featured_image: assets/images/posts/pinokio/pinokio1.webp
---

In the previous article we outlined what we are going to design and implement and the features our final deliverable will have. 
In this article we are going to examine the proposed architecture utilizing AWS and Docker Swarm. 
We will explore the reasons we chose this architecture, the pros and cons and any alternatives we could have chosen instead. 
As always in software architecture and in software engineering there is no right or wrong answer.

<!--more-->

## Architecture Overview

Here’s a high-level overview of the architecture:

### Key Components:

* Users: Initiate HTTP requests to shorten or resolve URLs.
* Route 53: AWS DNS service that resolves domain names and directs traffic.
* CloudFront: AWS CDN that caches shortened urls and their mapping to the original urls.
* API Gateway: Handles SSL termination and routes requests to the backend.
* Elastic Load Balancer (ELB): Balances incoming traffic across Docker Swarm worker nodes.
* Docker Swarm Cluster: Processes requests and runs the backend services.
* DynamoDB: Stores persistent URL mappings.
* GitHub and GitHub Actions: Manage the CI/CD pipeline for deployment.
* CloudWatch: Monitors metrics and manages the auto-scaling group.
* CloudFormation: Manages infrastructure as code for deployment and configuration.

### Detailed Architecture
1. End Users: 

    End users are initiating requests to shorten URLs or access already shortened URLs.
2. Route 53
  * **Role**: DNS resolution
  * **What it does**: Translates api.pinokio.com to the CloudFront distribution.
  * **Why**: Route 53 ensures reliable and scalable DNS management, providing low latency by routing end-users to the nearest CloudFront edge location.
3. CloudFront
  * **Role**: Content Delivery Network (CDN)
  * **What it does**: Caches shortened urls and forwards requests to API Gateway for creation and deletion and for cache misses.
  * **Why**: CloudFront reduces latency and improves response times by caching frequently accessed content and handling requests at edge locations.
4. API Gateway
  * **Role**: Request Handling, SSL Termination and Rate limiting.
  * **What it does**: Manages and routes HTTP requests, terminates SSL connections, and forwards requests to the ELB. It also manages the rate limiting.
  * **Why**: API Gateway provides a secure entry point, handling different HTTP methods (GET, POST, DELETE) and ensuring SSL encryption for data in transit.
5. Elastic Load Balancer (ELB)
  * **Role**: Load Balancing
  * **What it does**: Distributes incoming traffic evenly across the Docker Swarm worker nodes.
  * **Why**: ELB ensures high availability and fault tolerance by routing requests only to healthy instances.
6. Docker Swarm Cluster
  * **Role**: Backend Processing
  * **What it does**: Hosts and manages the backend services for actual shortening and resolving of URLs.
  * **Why**: Docker Swarm provides container orchestration, allowing scalable and reliable service deployment and management.
7. DynamoDB
  * **Role**: Persistent Storage
  * **What it does**: Stores the long-term URL mappings and metadata.
  * **Why**: DynamoDB provides scalable and reliable NoSQL storage.
8. GitHub and GitHub Actions
  * **Role**: CI/CD Pipeline
  * **What it does**: Manages the source code and automates the deployment process using GitHub Actions.
  * **Why**: Automates the CI/CD pipeline.
9. CloudWatch
  * **Role**: Monitoring and Auto-Scaling
  * **What it does**: Monitors metrics for API Gateway, ELB, and Docker Swarm, managing auto-scaling actions based on defined thresholds.
  * **Why**: CloudWatch provides monitoring and alerting and enables dynamic scaling of resources.
10. CloudFormation
  * **Role**: Infrastructure as Code (IaC)
  * **What it does**: Manages the deployment and configuration of all AWS resources.
  * **Why**: CloudFormation automates the setup and management of the infrastructure.

### Architectural diagram

The diagram was built using diagram as code with [Mingrammer](https://diagrams.mingrammer.com/).

{% include image-caption.html imageurl="/assets/images/posts/pinokio/pinokio-architecture-diagram.png#wide" title="Architecture diagram" %}

### Why This Architecture?

This architecture was chosen because of:

1. Scalability: Using Docker Swarm and Auto Scaling we can ensure the dynamic scaling of containers across our nodes and also the dynamic increase and decrease of system nodes based on various load factors.
2. Performance: CloudFront provides edge caching for GET/HEAD requests.
3. Reliability: ELB distributes load across worker nodes, and DynamoDB provides reliable, persistent storage with very low latency.
4. Security: API Gateway handles SSL termination and rate limiting which are offloaded from our business logic.
5. Monitoring: CloudWatch provides monitoring and scaling management, while CloudFormation manages infrastructure deployment and updates as code.
6. Automation: GitHub Actions automates the CI/CD process.

### Alternative approaches

While the current architecture utilizes a lot of industry proven AWS services, there are some alternative approaches to follow:

1. Kubernetes instead of Docker Swarm:
  - Pros: More active community and enables to have more advanced setups.
  - Cons: High complexity and requisite of expertise.
2. Fargate or ECS:
  - Pros: No need to manage EC2 instances and the scaling is done automatically.
  - Cons: No access to the underlying resources, 3x or 4x more costs in infrastructure.
3. AWS Lambda:
  - Pros: Simplify scaling and infrastructure management.
  - Cons: Cold start latency can affect performance, more costly in the long run.

### Conclusion

In this article we explored the proposed architecture, the pros and cons of our choices and the alternative approaches. 
In the next article we will start creating the backend application step by step using Java 21 and Spring Boot framework.

Stay tuned!
