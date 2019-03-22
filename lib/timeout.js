var _timeout    = 120 * 1000;
var _retrydelay = 1 * 1000;

module.exports = {

  timeout: function(t) {
    if (t) {
      _timeout = t * 1000;
    }
    return _timeout;
  },

  retrydelay : function(r) {
    if (r) {
      _retrydelay = r * 1000;
    }
    return _retrydelay;
  },

};
