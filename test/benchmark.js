'use strict';
/*global console, Promise*/

var async = require('async'),
  Bluebird = require("bluebird"),
  thenjs = require('../then.js'),
  JSBench = require('jsbench');

var list = [], tasks = [], tasksP = [], tasksB = [];

function task(callback) {
  // 模拟同步任务
  // callback(null, 1);
  // 模拟异步任务
  thenjs.nextTick(function () {
    callback(null, 1);
  });
}

function taskP() {
  // 预封装 Promise，优化测分
  return new Promise(function (resolve) {
    // 模拟同步任务
    // resolve(1);
    // 模拟异步任务
    thenjs.nextTick(function () {
      resolve(1);
    });
  });
}

function taskB() {
  // 预封装 Bluebird，优化测分
  return new Bluebird(function (resolve) {
    // 模拟同步任务
    // resolve(1);
    // 模拟异步任务
    thenjs.nextTick(function () {
      resolve(1);
    });
  });
}

// 构造任务流
for (var i = 0; i < 1000; i++) {
  list[i] = i;
  tasks[i] = task;
  tasksP[i] = taskP;
  tasksB[i] = taskB;
}

var jsbench = new JSBench();

// 如果支持 Promise，则加入 Promise 测试
if (typeof Promise === 'function') {
  jsbench.add('Promise', function (callback) {
    // 原生 Promise 测试主体
    Promise.all(list.map(function (i) { // 并行 list 队列
      return taskP();
    })).then(function () {
      return list.reduce(function (promise, i) { // 串行 list 队列
        return promise.then(function () {
          return taskP();
        });
      }, Promise.resolve());
    }).then(function () {
      return Promise.all(tasksP);
    }).then(function () {
      return tasksP.reduce(function (promise, subTask) { // 串行 tasks 队列
        return promise.then(function () {
          return subTask();
        });
      }, Promise.resolve());
    }).then(function () {
      callback();
    });
  });
}

// try { // 检测是否支持 generator，是则加载 co 测试
//   new Function('return function* () {}');
//   jsbench.add('co', require('../test-es6/co.js')())
// } catch (e) {}

jsbench.add('bluebird', function (callback) {
  // 原生 Promise 测试主体
  // console.log('aaaa', list, tasksB)
  Bluebird.map(list, function (i) { // 并行 list 队列
    return taskB();
  }).then(function () {
    return Bluebird.reduce(list, function (x, i) { // 串行 list 队列
      return taskB();
    }, 0);
  }).then(function () { // 并行 tasks 队列
    return Promise.all(tasksB.map(function (subTask) {
      return subTask();
    }));
  }).then(function () {  // 串行 tasks 队列
    return tasksB.reduce(function (promise, subTask) { // 串行 tasks 队列
      return promise.then(function () {
        return subTask();
      });
    }, Bluebird.resolve());
  }).then(function (a) {
    // console.log('bbb', list, tasksB)
    return callback();
  });
}).add('async', function (callback) {
  // async 测试主体
  async.each(list, function (i, next) { // 并行 list 队列
    task(next);
  }, function (err) {
    if (err) return callback(err);
    async.eachSeries(list, function (i, next) { // 串行 list 队列
      task(next);
    }, function (err) {
      if (err) return callback(err);
      async.parallel(tasks, function (err) { // 并行 tasks 队列
        if (err) return callback(err);
        async.series(tasks, callback); // 串行 tasks 队列
      });
    });
  });
}).add('thenjs', function (callback) {
  // thenjs 测试主体
  thenjs.each(list, function (cont, i) { // 并行 list 队列
    task(cont);
  })
  .eachSeries(list, function (cont, i) { // 串行 list 队列
    task(cont);
  })
  .parallel(tasks) // 并行 tasks 队列
  .series(tasks) // 串行 tasks 队列
  .all(function (cont, error) {
    callback(error);
  });
}).run(10); // 循环测试 10 次
