const { defineConfig } = require('eslint/config');
const auraConfig = require('@salesforce/eslint-plugin-aura');
const lwcConfig = require('@salesforce/eslint-config-lwc/recommended');

module.exports = defineConfig([
    // Aura configuration
    {
        files: ['**/aura/**/*.js'],
        extends: [
            ...auraConfig.configs.recommended,
            ...auraConfig.configs.locker
        ]
    },

    // LWC configuration
    {
        files: ['**/lwc/**/*.js'],
        extends: [lwcConfig]
    }
]);