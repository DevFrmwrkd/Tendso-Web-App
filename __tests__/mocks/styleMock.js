// CSS modules carry no runtime behavior in the node-based UI tests.
module.exports = new Proxy({}, {
    get: (_target, key) => key === '__esModule' ? false : key,
});
