type Config = {
    cameraPositionSpeed: number;
    cameraRotationSpeed: number;
    fov: number;
    cameraPosition: Point;
    cameraRotation: [pitch: number, yaw: number];
    gridResolution: Record<'x' | 'y', number>;
};
type Point = [x: number, y: number, z: number];
type Camera = {
    id: number;
    position: Point;
    widthFov: number;
    heightFov: number;
    xyAngle: number;
    xzAngle: number;
};
type Obstacle = {
    points: Point[];
};
type TargetArea = {
    points: Point[];
    minAOV: number;
    maxAOV: number;
};
type Cell = {
    id: number;
    points: Point[];
    minAOV: number;
    maxAOV: number;
};

export type { Config, Point, Camera, Obstacle, TargetArea, Cell };
