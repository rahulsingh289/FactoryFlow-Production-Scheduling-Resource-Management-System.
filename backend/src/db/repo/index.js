// Repository: every data operation the API needs, implemented for BOTH the
// MySQL backend and the in-memory fallback store. Routes call these functions
// and never care which mode is active.
module.exports = Object.assign({},
  require('./users'),
  require('./orders'),
  require('./machines'),
  require('./workers'),
  require('./inventory'),
  require('./pools'),
  require('./bankers'),
  require('./scheduling'),
  require('./reports'),
);
