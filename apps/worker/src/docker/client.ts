import Docker from 'dockerode';

const isWindows = process.platform === 'win32';
export const docker = new Docker(
  isWindows
    ? { socketPath: '//./pipe/dockerDesktopLinuxEngine' }
    : { socketPath: '/var/run/docker.sock' }
);
