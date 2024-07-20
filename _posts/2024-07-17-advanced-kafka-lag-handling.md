---
layout: post
title: "Detecting kafka consumer lag: Programmatic guide"
tags: [ Kafka, Java, Spring Boot ]
featured_image_thumbnail: assets/images/posts/misc/kafka-advanced_thumbnail.jpeg
featured_image: assets/images/posts/misc/kafka-advanced.jpeg
---

In this article we are going to demonstrate how to detect kafka consumer lag accurately across any of the partitions of
a topic
and determine if a kafka consumer is stuck and therefore we should take protective measures.

<!--more-->

## Tech stack

1. Java: Knowledge of Java or another JVM language is necessary.
2. Spring Boot: Knowledge of Spring Boot is deemed necessary.

## Understanding Kafka consumer lag

Consumer lag in Kafka refers to the delay between the latest message written to a Kafka partition and the latest message
that has been read by a consumer.
It is a critical metric in Kafka ecosystems, indicating how far behind the consumer is in processing messages.
High consumer lag can lead to several problems:

1. Delayed Data Processing: When consumer lag is high, it means that the consumer is processing messages much slower
   than they are being produced. This can lead to significant delays in data processing and real-time analytics.
2. Resource Overload: High lag can indicate that the consumer is overwhelmed, possibly due to insufficient resources or
   inefficient processing logic. This can eventually lead to resource exhaustion and crashes.
3. Backpressure: If consumers cannot keep up with the rate of incoming messages, it can cause backpressure in the
   system, leading to potential message loss or the need for complex backpressure handling mechanisms.

## Factors affecting consumer lag

1. Message Production Rate: If the rate at which producers send messages to the topic exceeds the rate at which
   consumers process them, lag will increase.
2. Consumer Processing Time: Longer processing times per message will contribute to increased lag.
3. System Resources: CPU, memory, and network bandwidth limitations can affect consumer performance and contribute to
   lag.
4. Consumer Configuration: Consumer settings such as fetch size, poll intervals, and parallelism can impact lag.
5. Rebalancing

## What is rebalancing

Rebalancing is the process of redistributing partitions among consumers in a consumer group. This can happen due to:

1. A new consumer joining the group.
2. An existing consumer leaving the group.
3. A topic being added or removed.

Rebalancing ensures that all partitions are equally distributed among the consumers.

## Challenges with rebalancing

Challenges with Rebalancing

During rebalancing, the Kafka consumer must handle the reassignment gracefully to avoid:

1. Message duplication
2. Increased lag
3. Temporary unavailability

<!--more-->

## What is the proposal

The proposal is to integrate handling of rebalancing operations in our spring boot kafka consumer while simultaneously
track in real time
the lag of a topic across all its partitions and whether the consumer is stuck.

This allows us to respond to changes immediately and make adjustments on-the-fly, use custom lag processing, error
handling, and integration with other systems such as monitoring systems, alerting
mechanisms and other services such as Prometheus, Grafana, OpsGenie/PagerDuty.

It also handles rebalances in real-time using a `ConsumerRebalanceListener`, which allows for immediate actions like
committing offsets and clearing partition lag information.

## Implementation steps

First let's create a class named AdvancedKafkaConsumerService. The necessary imports to add are:

<pre><code class="language-java">
package com.soumakis;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.stereotype.Service;

</code></pre>

Then we define the class level constants and fields

<pre><code class="language-java">
@Service
public class AdvancedKafkaConsumerService {

  private static final long GRACE_PERIOD_MS = 30000; // 30 seconds grace period
  private static final long HISTORY_RESET_PERIOD_MS = 120000; // 120 seconds to reset history
  private static final int MAX_NON_CONSUMING_POLLS = 5; // Number of consecutive polls with no consumption to consider lag stable

  private final KafkaConsumer&lt;String, String&gt; consumer;
  private final ScheduledExecutorService executorService;
  private final Map&lt;Integer, Long&gt; partitionLagMap = new ConcurrentHashMap&lt;&gt;();
  private final Queue&lt;Long&gt; lagHistory = new ConcurrentLinkedQueue&lt;&gt;();

  private long lastRebalanceTime = System.currentTimeMillis();
  private long lastHistoryResetTime = System.currentTimeMillis();
  private long lastConsumedTime = System.currentTimeMillis();
  private int nonConsumingPolls = 0;

</code></pre>

Initializing the constructor and the dependencies

<pre><code class="language-java">
  @Autowired
  public AdvancedKafkaConsumerService(ConsumerFactory&lt;String, String&gt; consumerFactory) {
    this.consumer = (KafkaConsumer&lt;String, String&gt;) consumerFactory.createConsumer(
        "advancedKafkaExample", null);
    this.executorService = Executors.newSingleThreadScheduledExecutor();
  }

  @PostConstruct
  void init() {
    consumer.subscribe(Collections.singletonList("test_topic"), new CustomRebalanceListener());
    startConsuming();
  }

</code></pre>

Pay attention to `Executors.newSingleThreadScheduledExecutor()`. By default a kafka consumer is single threaded.

Public methods for lag initialization

<pre><code class="language-java">
  public long getLag() {
    return partitionLagMap.values().stream().mapToLong(Long::longValue).sum();
  }

  public int getNonConsumingPolls() {
    return nonConsumingPolls;
  }

  public boolean isLagStable() {
    long now = System.currentTimeMillis();
    if (now - lastRebalanceTime < GRACE_PERIOD_MS) {
      System.out.println("In grace period, skipping lag stability check.");
      return false;
    } else if (now - lastConsumedTime > GRACE_PERIOD_MS) {
      System.out.println(
          "No messages consumed for longer than the grace period, considering lag stable.");
      return true;
    } else {
      return nonConsumingPolls >= MAX_NON_CONSUMING_POLLS
          || lagHistory.stream().distinct().count() == 1;
    }
  }

</code>
</pre>

1. getLag(): Returns the total lag across all partitions.
2. getNonConsumingPolls(): Returns the count of consecutive non-consuming polls.
3. isLagStable(): Checks if the lag is stable based on the grace period and non-consuming polls.

Then the code for defining the processing of the records and updating the partition lag and lag history

<pre><code class="language-java">
@PreDestroy
  public void shutdown() {
    executorService.submit(() -> {
      consumer.wakeup();
      consumer.close();
      executorService.shutdown();
    });
  }

  /**
   * Poll records from the Kafka topic.
   */
  void pollRecords() {
    var records = consumer.poll(Duration.ofSeconds(3));
    processRecords(records);
  }

  /**
   * Reset the lag history periodically to keep memory usage low.
   */
  void resetLagHistoryPeriodically() {
    long now = System.currentTimeMillis();
    if (now - lastHistoryResetTime > HISTORY_RESET_PERIOD_MS) {
      lagHistory.clear();
      lastHistoryResetTime = now;
    }
  }

  /**
   * Get the number of elements in the lag history.
   *
   * @return the size of the lag history
   */
  int getLagHistorySize() {
    return lagHistory.size();
  }

  private void startConsuming() {
    executorService.scheduleAtFixedRate(this::pollRecords, 0, 3, TimeUnit.SECONDS);
    executorService.scheduleAtFixedRate(this::resetLagHistoryPeriodically, 0,
        HISTORY_RESET_PERIOD_MS,
        TimeUnit.MILLISECONDS);
  }

  /**
   * Process the records received from the Kafka topic. It simulates processing time, updates the
   * lag info and commits the offset.
   *
   * @param records the records to process
   */
  private void processRecords(Iterable&lt;ConsumerRecord&lt;String, String&gt;&gt; records) {
    if (!records.iterator().hasNext()) {
      nonConsumingPolls++;
    } else {
      nonConsumingPolls = 0;
      lastConsumedTime = System.currentTimeMillis();
    }

    for (ConsumerRecord&lt;String, String&gt; record : records) {
      System.out.println(
          "Received message: " + record.value() + " from partition: " + record.partition());
      simulateProcessingDelay();
      updateLagInfo(record);
      commitOffset(record);
    }
  }

  private void simulateProcessingDelay() {
    try {
      Thread.sleep(2000); // 2 seconds delay
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RuntimeException(e);
    }
  }

  /**
   * Update the lag info for the given record. It calculates the lag for the partition and updates
   * the lag history.
   *
   * @param record the record to update the lag info for
   */
  private void updateLagInfo(ConsumerRecord&lt;String, String&gt; record) {
    int partition = record.partition();
    long currentOffset = record.offset();
    long latestOffset = consumer
        .endOffsets(Collections.singleton(new TopicPartition(record.topic(), partition)))
        .get(new TopicPartition(record.topic(), partition));
    long lag = latestOffset - currentOffset;
    partitionLagMap.put(partition, lag);

    // Add the lag to history
    if (lagHistory.size() >= 10) {
      lagHistory.poll();
    }
    lagHistory.offer(lag);
  }

  /**
   * Commits the offset for the given record and updates the lag info.
   *
   * @param record the record to commit the offset for
   */
  private void commitOffset(ConsumerRecord&lt;String, String&gt; record) {
    consumer.commitSync(Collections.singletonMap(
        new TopicPartition(record.topic(), record.partition()),
        new OffsetAndMetadata(record.offset() + 1)
    ));

    partitionLagMap.computeIfPresent(record.partition(), (k, v) -> {
      var x = v - 1;
      if (x < 0) {
        return 0L;
      }
      return x;
    });
  }
</code>
</pre>

And the custom rebalance listener implementation which allows for immediate actions like committing offsets
and clearing partition lag information while handling rebalances in real-time.

<pre><code class="language-java">
private class CustomRebalanceListener implements ConsumerRebalanceListener {

    /**
     * Commit the offsets before rebalancing. This is important to avoid processing the same message
     * multiple times.
     *
     * @param partitions the partitions to commit the offsets for
     */
    @Override
    public void onPartitionsRevoked(Collection&lt;TopicPartition&gt; partitions) {
      System.out.println("Committing offsets before rebalancing...");
      consumer.commitSync();

      partitions.forEach(partition -> partitionLagMap.remove(partition.partition()));
    }

    /**
     * Reset the lag history and partition lag map after rebalancing. This is important to avoid
     * stale lag info.
     *
     * @param partitions the partitions to reset the lag info for
     */
    @Override
    public void onPartitionsAssigned(Collection&lt;TopicPartition&gt; partitions) {
      System.out.println("Rebalanced: " + partitions);
      lastRebalanceTime = System.currentTimeMillis();
      lagHistory.clear();
      partitionLagMap.clear();
    }
  }
</code>
</pre>

**You can find the full implementation at** [here](https://github.com/VassilisSoum/AdvancedKafkaRebalanceHandling)
along with the integration tests written.

With the above implementation, we can now accurately detect kafka consumer lag across any of the partitions of
a topic and determine if a kafka consumer is stuck in real time.

## Conclusion

In this article, we have demonstrated how to detect kafka consumer lag accurately across any of the partitions
of a topic in real time.

## Sources used
1. [Intelligent, automatic restarts for unhealthy Kafka consumers](https://blog.cloudflare.com/intelligent-automatic-restarts-for-unhealthy-kafka-consumers)
