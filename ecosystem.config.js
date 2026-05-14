module.exports = {
  apps: [{
    name: 'flappy-bird',
    script: 'npm',
    args: 'start -- -p 3880',
    cwd: '/home/gelt/apps/flappy-bird',
    env: {
      NODE_ENV: 'production',
      PORT: 3880,
    },
  }],
}
