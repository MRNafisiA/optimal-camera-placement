import type {
    Config,
    Point,
    TargetArea,
    Camera,
    Obstacle,
    Cell
} from './types.ts';

const CellsPerThread = 500;

const dotVec = (p1: Point, p2: Point) =>
    p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2];

const sumVec = (p1: Point, p2: Point): Point => [
    p1[0] + p2[0],
    p1[1] + p2[1],
    p1[2] + p2[2]
];

const minusVec = (p1: Point, p2: Point): Point => [
    p1[0] - p2[0],
    p1[1] - p2[1],
    p1[2] - p2[2]
];

const multiplyVec = (p1: Point, c: number): Point => [
    p1[0] * c,
    p1[1] * c,
    p1[2] * c
];

const divideVec = (p1: Point, c: number): Point => [
    p1[0] / c,
    p1[1] / c,
    p1[2] / c
];

const getNormalVector = (p1: Point, p2: Point, p3: Point) => {
    const p1ToP2: Point = minusVec(p2, p1);
    const p1ToP3: Point = minusVec(p3, p1);
    return [
        p1ToP2[1] * p1ToP3[2] - p1ToP2[2] * p1ToP3[1],
        p1ToP2[2] * p1ToP3[0] - p1ToP2[0] * p1ToP3[2],
        p1ToP2[0] * p1ToP3[1] - p1ToP2[1] * p1ToP3[0]
    ] as Point;
};

const getNormalizedOrthogonalVectors = (
    p1: Point,
    p2: Point,
    p3: Point
): { v1: Point; v2: Point; normalVector: Point } => {
    const normalVector = getNormalVector(p1, p2, p3);
    const p1ToP2 = minusVec(p2, p1);
    const p1ToP2Length = Math.sqrt(
        Math.pow(p1ToP2[0], 2) + Math.pow(p1ToP2[1], 2) + Math.pow(p1ToP2[2], 2)
    );
    const orthogonalToP1ToP2: Point = [
        p1ToP2[1] * normalVector[2] - p1ToP2[2] * normalVector[1],
        p1ToP2[2] * normalVector[0] - p1ToP2[0] * normalVector[2],
        p1ToP2[0] * normalVector[1] - p1ToP2[1] * normalVector[0]
    ];
    const orthogonalToP1ToP2Length = Math.sqrt(
        Math.pow(orthogonalToP1ToP2[0], 2) +
            Math.pow(orthogonalToP1ToP2[1], 2) +
            Math.pow(orthogonalToP1ToP2[2], 2)
    );

    return {
        v1: divideVec(p1ToP2, p1ToP2Length),
        v2: divideVec(orthogonalToP1ToP2, orthogonalToP1ToP2Length),
        normalVector
    };
};

const isPointInPolygon3D = (polygon: Point[], point: Point): boolean => {
    const normalVector = getNormalVector(polygon[0], polygon[1], polygon[2]);
    const removingIndex = normalVector.findIndex(v => v !== 0);
    const projectedPolygon = polygon.map(
        point => point.filter((_, i) => i !== removingIndex) as Point
    );
    const projectedPoint = point.filter((_, i) => i !== removingIndex) as Point;
    return isPointInPolygon2D(projectedPolygon, projectedPoint);
};

const isPointInPolygon2D = (polygon: Point[], point: Point): boolean => {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];

        if ((x === xi && y === yi) || (x === xj && y === yj)) {
            return true;
        }

        if (
            yi === yj &&
            yi === y &&
            x > Math.min(xi, xj) &&
            x < Math.max(xi, xj)
        ) {
            return true;
        }

        const intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
};

const getPolygonsGrid = (
    config: Config,
    polygon: Point[]
): {
    rectangle: Point[];
    gridCells: Point[][];
} => {
    const { v1, v2 } = getNormalizedOrthogonalVectors(
        polygon[0],
        polygon[1],
        polygon[2]
    );
    const startPoint = polygon[0];
    const allCV1s = [];
    const allCV2s = [];

    // solve 3x2 equation problem
    const zeroThreshold = 0.0000000001;
    for (const point of polygon) {
        const a = [
            [v1[0], v2[0], point[0] - startPoint[0]],
            [v1[1], v2[1], point[1] - startPoint[1]],
            [v1[2], v2[2], point[2] - startPoint[2]]
        ];

        for (let i = 0; i < 2; i++) {
            if (Math.abs(a[i][i]) <= zeroThreshold) {
                const candidateRowIndex = a.findIndex(
                    (v, index) => Math.abs(v[i]) > zeroThreshold && index > i
                );
                const temp = a[candidateRowIndex];
                a[candidateRowIndex] = a[i];
                a[i] = temp;
            }
            for (let j = i + 1; j < 3; j++) {
                if (Math.abs(a[j][i]) > zeroThreshold) {
                    const coefficient = a[j][i] / a[i][i];
                    a[j][0] -= coefficient * a[i][0];
                    a[j][1] -= coefficient * a[i][1];
                    a[j][2] -= coefficient * a[i][2];
                }
            }
        }
        if (Math.abs(a[0][1]) > zeroThreshold) {
            const coefficient = a[0][1] / a[1][1];
            a[0][0] -= coefficient * a[1][0];
            a[0][1] -= coefficient * a[1][1];
            a[0][2] -= coefficient * a[1][2];
        }

        if (
            !(
                Math.abs(a[2][0]) <= zeroThreshold &&
                Math.abs(a[2][1]) <= zeroThreshold &&
                Math.abs(a[2][2]) <= zeroThreshold &&
                Math.abs(a[0][1]) <= zeroThreshold &&
                Math.abs(a[1][0]) <= zeroThreshold &&
                Math.abs(a[0][0]) > zeroThreshold &&
                Math.abs(a[1][1]) > zeroThreshold
            )
        ) {
            throw 'can not solve matrix.';
        }
        allCV1s.push(a[0][2] / a[0][0]);
        allCV2s.push(a[1][2] / a[1][1]);
    }

    // get grid points
    const minCV1 = Math.min(...allCV1s);
    const maxCV1 = Math.max(...allCV1s);
    const cV2 =
        Math.min(...allCV2s) !== 0
            ? Math.min(...allCV2s)
            : Math.max(...allCV2s);
    const minCV1Point = sumVec(startPoint, multiplyVec(v1, minCV1));
    const maxCV1Point = sumVec(startPoint, multiplyVec(v1, maxCV1));

    const gridCells: Point[][] = [];
    for (let i = minCV1; i < maxCV1; i += config.gridResolution.x) {
        const sign = cV2 > 0 ? 1 : -1;
        for (let j = 0; j < Math.abs(cV2) / config.gridResolution.y; j++) {
            const firstPoint = sumVec(
                sumVec(startPoint, multiplyVec(v1, i)),
                multiplyVec(v2, j * sign * config.gridResolution.y)
            );
            const secondPoint = sumVec(
                sumVec(
                    startPoint,
                    multiplyVec(v1, i + config.gridResolution.x)
                ),
                multiplyVec(v2, j * sign * config.gridResolution.y)
            );
            const cell: Point[] = [
                firstPoint,
                secondPoint,
                sumVec(
                    secondPoint,
                    multiplyVec(v2, sign * config.gridResolution.y)
                ),
                sumVec(
                    firstPoint,
                    multiplyVec(v2, sign * config.gridResolution.y)
                )
            ];

            const averagePoint: Point = cell.reduce(
                (pre, point, i) => {
                    if (i === cell.length - 1) {
                        return divideVec(sumVec(pre, point), cell.length);
                    }
                    return sumVec(pre, point);
                },
                [0, 0, 0]
            );
            if (isPointInPolygon3D(polygon, averagePoint)) {
                gridCells.push(cell);
            }
        }
    }

    return {
        rectangle: [
            minCV1Point,
            maxCV1Point,
            sumVec(maxCV1Point, multiplyVec(v2, cV2)),
            sumVec(minCV1Point, multiplyVec(v2, cV2))
        ],
        gridCells
    };
};

const checkObstacleBlockingCell = (
    cameraPosition: Camera['position'],
    obstacle: Point[],
    cell: Point[]
) => {
    const [point1, point2, point3, point4] = cell;
    const checkingPoints: Point[] = [
        point1,
        divideVec(sumVec(point1, point2), 2),
        point2,
        divideVec(sumVec(point2, point3), 2),
        point3,
        divideVec(sumVec(point3, point4), 2),
        point4,
        divideVec(sumVec(point4, point1), 2),
        divideVec(sumVec(sumVec(sumVec(point1, point2), point3), point4), 4)
    ];
    const pointOnPlane = obstacle[0];
    const normalVector = getNormalVector(obstacle[0], obstacle[1], obstacle[2]);
    for (const checkingPoint of checkingPoints) {
        const top = dotVec(
            normalVector,
            minusVec(cameraPosition, pointOnPlane)
        );
        const bottom = dotVec(
            normalVector,
            minusVec(cameraPosition, checkingPoint)
        );
        if (bottom === 0) {
            continue;
        }
        const t = top / bottom;
        if (
            0 < t &&
            t < 1 &&
            isPointInPolygon3D(
                obstacle,
                sumVec(
                    cameraPosition,
                    multiplyVec(minusVec(checkingPoint, cameraPosition), t)
                )
            )
        ) {
            return true;
        }
    }
    return false;
};

const getAngleFromHorizon = ([x, yOrZ]: [x: number, yOrZ: number]) => {
    let angle = 0;
    let sign = 1;
    const arcTan = Math.atan(Math.abs(yOrZ / x));
    if (yOrZ < 0) {
        angle += Math.PI;
    }
    if (x * yOrZ < 0) {
        angle += Math.PI;
        sign = -1;
    }

    return angle + sign * arcTan;
};

const checkFovBlockingCell = (camera: Camera, cell: Point[]) => {
    for (const point of cell) {
        let xyAngleDifference = Math.abs(
            camera.xyAngle -
                getAngleFromHorizon([
                    point[0] - camera.position[0],
                    point[1] - camera.position[1]
                ])
        );
        let xzAngleDifference = Math.abs(
            camera.xzAngle -
                getAngleFromHorizon([
                    point[0] - camera.position[0],
                    point[2] - camera.position[2]
                ])
        );
        if (xyAngleDifference > Math.PI) {
            xyAngleDifference = Math.PI * 2 - xyAngleDifference;
        }
        if (xzAngleDifference > Math.PI) {
            xzAngleDifference = Math.PI * 2 - xzAngleDifference;
        }
        if (
            xyAngleDifference > camera.widthFov ||
            xzAngleDifference > camera.heightFov
        ) {
            return true;
        }
    }
    return false;
};

const pointToLineSegmentDistance = (p: Point, a: Point, b: Point) => {
    const ab = minusVec(b, a);
    const ap = minusVec(p, a);
    const bp = minusVec(p, b);

    const dotProd = dotVec(ap, ab);
    const abLengthSq = dotVec(ab, ab);

    let t = dotProd / abLengthSq;
    t = Math.max(0, Math.min(1, t));

    const closestPoint = sumVec(a, multiplyVec(ab, t));
    const d = minusVec(p, closestPoint);

    return [
        Math.sqrt(dotVec(d, d)),
        Math.sqrt(dotVec(ap, ap)),
        Math.sqrt(dotVec(bp, bp))
    ];
};

const checkAngleOfViewBlockingCell = (
    cameraPosition: Point,
    targetArea: TargetArea
) => {
    const normal = getNormalVector(
        targetArea.points[0],
        targetArea.points[1],
        targetArea.points[2]
    );
    const normalLength = Math.sqrt(
        normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2
    );
    const unitNormal = normal.map(n => n / normalLength) as Point;

    const d = -dotVec(unitNormal, targetArea.points[0]);
    const t = dotVec(unitNormal, cameraPosition) + d;
    const projectedPoint = minusVec(cameraPosition, multiplyVec(unitNormal, t));

    let minDist = Infinity;
    let maxDist = -Infinity;
    for (let i = 0; i < targetArea.points.length; i++) {
        const a = targetArea.points[i];
        const b = targetArea.points[(i + 1) % targetArea.points.length];
        const distances = pointToLineSegmentDistance(projectedPoint, a, b);

        minDist = Math.min(minDist, ...distances);
        maxDist = Math.max(maxDist, ...distances);
    }

    const cameraPositionToProjectedLength = Math.sqrt(
        dotVec(
            minusVec(projectedPoint, cameraPosition),
            minusVec(projectedPoint, cameraPosition)
        )
    );
    const maxAngle = Math.atan(maxDist / cameraPositionToProjectedLength);
    const minAngle = Math.atan(minDist / cameraPositionToProjectedLength);

    return !(
        targetArea.minAOV < minAngle &&
        minAngle < targetArea.maxAOV &&
        targetArea.minAOV < maxAngle &&
        maxAngle < targetArea.maxAOV
    );
};

const optimizeMatrix = (
    matrix: Record<number, Record<number, boolean>>,
    by: 'cell' | 'camera'
) => {
    const cameraIDs = Object.keys(matrix).map(Number);
    if (cameraIDs.length === 0) {
        return false;
    }
    const cellIDs = Object.keys(matrix[cameraIDs[0]]).map(Number);
    const codes = (by === 'cell' ? cellIDs : cameraIDs).map(byID => {
        let code = '';
        (by === 'cell' ? cameraIDs : cellIDs).forEach(otherID => {
            if (
                matrix[by === 'cell' ? otherID : byID][
                    by === 'cell' ? byID : otherID
                ]
            ) {
                code += '1';
            } else {
                code += '0';
            }
        });
        return { id: byID, code };
    });
    console.info('generating codes DONE !!!');
    const removingByIDs: number[] = [];
    main: for (let i = 0; i < codes.length; i++) {
        if (i % 100 === 0) {
            console.info(`optimizing matrix ${i}/${codes.length}.`);
        }
        if (removingByIDs.includes(codes[i].id)) {
            continue;
        }
        if (!codes[i].code.includes('1')) {
            removingByIDs.push(codes[i].id);
            continue;
        }
        for (let j = i + 1; j < codes.length; j++) {
            if (removingByIDs.includes(codes[j].id)) {
                continue;
            }
            if (!codes[j].code.includes('1')) {
                removingByIDs.push(codes[j].id);
                continue;
            }
            const temp = codes[i].code
                .split('')
                .map((v, i) =>
                    (Number(v) & Number(codes[j].code[i])).toString()
                )
                .join('');
            if (temp === codes[i].code) {
                if (by === 'cell') {
                    removingByIDs.push(codes[j].id);
                    continue;
                } else {
                    removingByIDs.push(codes[i].id);
                    continue main;
                }
            }
            if (temp === codes[j].code) {
                if (by === 'cell') {
                    removingByIDs.push(codes[i].id);
                    continue main;
                } else {
                    removingByIDs.push(codes[j].id);
                    continue;
                }
            }
        }
    }
    removingByIDs.forEach(byID => {
        if (by === 'cell') {
            cameraIDs.forEach(cameraID => {
                delete matrix[cameraID][byID];
            });
        } else {
            delete matrix[byID];
        }
    });
    console.info(`optimizing matrix DONE !!!`);
    return removingByIDs.length !== 0;
};

const removeRedundantFalse = (
    matrix: Record<number, Record<number, boolean>>
) => {
    const clone = JSON.parse(JSON.stringify(matrix));
    for (const cameraID in clone) {
        const _cameraID = Number(cameraID);
        for (const cellID in clone[_cameraID]) {
            const _cellID = Number(cellID);
            if (!clone[_cameraID][_cellID]) {
                delete clone[_cameraID][_cellID];
            }
        }
    }
    return clone;
};

const startAlgorithm = async (
    config: Config,
    obstacles: Obstacle[],
    targetAreas: TargetArea[],
    cameras: Camera[]
) => {
    let idCounter = 0;
    const cells: Cell[] = targetAreas.flatMap(targetArea =>
        getPolygonsGrid(config, targetArea.points).gridCells.map(points => ({
            id: ++idCounter,
            points,
            minAOV: targetArea.minAOV,
            maxAOV: targetArea.maxAOV
        }))
    );
    console.info('creating grid DONE !!!');
    console.info(
        `processing ${obstacles.length} obstacles, ${cells.length} cells and ${cameras.length} cameras.`
    );

    const originalMatrix: Record<number, Record<number, boolean>> = {};
    cameras.forEach(camera => {
        originalMatrix[camera.id] = {};
    });

    return new Promise(resolve => {
        const threadMap: Record<number, boolean> = {};
        for (let i = 0; i < cells.length; i += CellsPerThread) {
            const threadID = i / CellsPerThread + 1;
            threadMap[threadID] = false;
            const worker = new Worker('./src/algorithm.ts', { type: 'module' });
            worker.onmessage = event => {
                const partialMatrix: Record<
                    number,
                    Record<number, boolean>
                > = event.data;
                for (const cameraID in partialMatrix) {
                    const _cameraID = Number(cameraID);
                    for (const cellID in partialMatrix[_cameraID]) {
                        const _cellID = Number(cellID);
                        originalMatrix[_cameraID][_cellID] =
                            partialMatrix[_cameraID][_cellID];
                    }
                }

                worker.terminate();
                threadMap[threadID] = true;
                console.info(`thread ${threadID} exited.`);
                if (
                    Array.from(new Set(Object.values(threadMap))).length === 1
                ) {
                    console.info('creating original matrix DONE !!!');
                    resolve(undefined);
                }
            };
            worker.onerror = event => {
                throw event;
            };
            worker.postMessage({
                obstacles,
                cells: cells.slice(i, i + CellsPerThread),
                cameras,
                threadID
            });
        }
    }).then(() => {
        let by: 'cell' | 'camera' = 'cell';
        let iterationWithoutChanges = 0;
        while (iterationWithoutChanges < 2) {
            if (optimizeMatrix(originalMatrix, by)) {
                iterationWithoutChanges = 0;
            } else {
                iterationWithoutChanges++;
            }
            by = by === 'cell' ? 'camera' : 'cell';
        }

        console.log(JSON.parse(JSON.stringify(originalMatrix)));
        console.info('optimizing DONE !!!');
        const keys = Object.keys(originalMatrix);
        return {
            config,
            obstacles,
            targetAreas,
            cells,
            cameras,
            originalSize: [cameras.length, cells.length],
            optimizedSize: [
                keys.length,
                Object.keys(originalMatrix[Number(keys[0])]).length
            ],
            optimizedMatrix: removeRedundantFalse(originalMatrix)
        };
    });
};

if (self.window === undefined) {
    self.addEventListener('message', event => {
        const { obstacles, cells, cameras, threadID } = event.data as {
            obstacles: Obstacle[];
            cells: Cell[];
            cameras: Camera[];
            threadID: number;
        };
        console.info(`thread ${threadID} processing ${cells.length} cells.`);
        const partialMatrix: Record<number, Record<number, boolean>> = {};
        cameras.forEach(camera => {
            partialMatrix[camera.id] = {};
        });
        cells.forEach((cell, index) => {
            cameras.forEach(camera => {
                partialMatrix[camera.id][cell.id] = !(
                    checkFovBlockingCell(camera, cell.points) ||
                    checkAngleOfViewBlockingCell(camera.position, cell) ||
                    obstacles.some(obstacle =>
                        checkObstacleBlockingCell(
                            camera.position,
                            obstacle.points,
                            cell.points
                        )
                    )
                );
            });
            if (index % 50 === 0) {
                console.info(
                    `thread ${threadID} processing ${index}/${cells.length}.`
                );
            }
        });
        optimizeMatrix(partialMatrix, 'cell');
        self.postMessage(partialMatrix);
    });
}

export {
    CellsPerThread,
    dotVec,
    sumVec,
    minusVec,
    multiplyVec,
    divideVec,
    getNormalVector,
    getNormalizedOrthogonalVectors,
    isPointInPolygon3D,
    isPointInPolygon2D,
    getPolygonsGrid,
    checkObstacleBlockingCell,
    getAngleFromHorizon,
    checkFovBlockingCell,
    pointToLineSegmentDistance,
    checkAngleOfViewBlockingCell,
    optimizeMatrix,
    startAlgorithm
};
