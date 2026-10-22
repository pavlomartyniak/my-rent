const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Бекенд (NestJS) живе в цій же репозиторії, але не є частиною мобільного бандла
config.resolver.blockList = [].concat(config.resolver.blockList ?? [], /\/backend\/.*/);

module.exports = config;
