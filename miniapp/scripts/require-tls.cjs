// zmp-cli 4.0.3 sets this to 0 internally; deployment must verify certificates.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
process.env = new Proxy(process.env, {
  set(target, key, value) {
    return Reflect.set(target, key, key === 'NODE_TLS_REJECT_UNAUTHORIZED' ? '1' : value);
  },
});
