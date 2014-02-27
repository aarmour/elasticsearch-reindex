var debug = require('debug')('reindex');
var async = require('async');
var elasticsearch = require('elasticsearch');
var events = require('events');
var util = require('./util');

var emitter = new events.EventEmitter();

var srcClient, dstClient;
var srcIndex, dstIndex;
var scrollId;

exports = module.exports = function(options) {
  if (!options) { options = {}; }

  options.scroll = options.scroll || '2m';

  var srcHost = options.srcHost;
  var dstHost = options.dstHost || options.srcHost;
  srcIndex = options.srcIndex;
  dstIndex = options.dstIndex || options.srcIndex;

  delete options.srcHost;
  delete options.dstHost;
  delete options.srcIndex;
  delete options.dstIndex;

  srcClient = elasticsearch.Client(util.extend({}, options, { host: srcHost }));
  dstClient = elasticsearch.Client(util.extend({}, options, { host: dstHost }));

  // Initial query to get the scroll ID
  srcClient.search({
    index: srcIndex,
    searchType: 'scan',
    scroll: options.scroll,
    body: {
      query: {
        match_all: {}
      }
    }
  })
  .then(
    function(response) {
      scrollId = response._scroll_id;

      debug('scroll ID: ' + scrollId);

      emitter.emit('message', 'total hits: ' + response.hits.total);

      var hits = [];
      var runningCount = 0;

      // Scroll until there are no more hits
      async.doWhilst(
        function(callback) {
          srcClient.scroll({
            scroll: options.scroll,
            scrollId: scrollId
          })
          .then(
            function(response) {
              scrollId = response._scroll_id;
              hits = response.hits.hits;
              runningCount += response.hits.hits.length;

              debug('scroll ID: ' + scrollId);
              debug('hit count: ' + hits.length + ' / ' + runningCount);

              bulk(hits, callback);
            },
            handleError
          );
        },
        function() { return hits.length; },
        function(error) {
          if (error) {
            handleError(error);
          }
          else {
            cleanUp(function() {
              emitter.emit('done');
            });
          }
        }
      );
    },
    handleError
  );
};

exports.on = function() {
  emitter.on.apply(emitter, arguments);
};

function bulk(hits, callback) {
  if (!hits.length) {
    return callback();
  }

  var body = hits.reduce(function(previous, current) {
    return previous.concat([
      { index: { _index: dstIndex, _type: current._type, _id: current._id } },
      current._source
    ]);
  }, []);

  dstClient.bulk({ body: body }, callback);
}

function handleError(error) {
  cleanUp(function() {
    emitter.emit('error', error);
  });
}

function cleanUp(callback) {
  srcClient.clearScroll({ scrollId: scrollId }, callback, callback);
}
