var _timeout    = 30;
var _retrydelay = 5;

module.exports = {
  
  timeout: function(t) {
    if (t) {
      _timeout = t;
    }
    return _timeout;
  },

  retrydelay : function(r) {
    if (r) {
      _retrydelay = r;
    }
    return _retrydelay;
  },

};
