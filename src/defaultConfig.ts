import type { Config } from './types.ts';

const defaultConfig: Config = {
    cameraPositionSpeed: 0.1,
    cameraRotationSpeed: 0.05,
    fov: 75,
    cameraPosition: [0, 0, 0],
    cameraRotation: [0, 0],
    gridResolution: { x: 0.2, y: 0.2 }
};

export { defaultConfig };
