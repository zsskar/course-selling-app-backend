module.exports = {
    apps: [
        {
            name: 'backend',
            script: 'dist/index.js',
            watch: true,
            env: {
                NODE_ENV: 'development',
            },
        },
    ],
};