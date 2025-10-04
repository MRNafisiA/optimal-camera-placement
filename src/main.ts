import * as THREE from 'three';
import {
    divideVec,
    getNormalizedOrthogonalVectors,
    isPointInPolygon3D,
    multiplyVec,
    startAlgorithm,
    sumVec
} from './algorithm.ts';
import { defaultConfig } from './defaultConfig.ts';
import type { Point, Config, Camera, Obstacle, TargetArea } from './types.ts';

const {
    dataDiv,
    dataToggleButton,
    startAlgorithmButton,
    mainDiv,
    saveButton,
    loadButton,
    cameraPositionSpeedInput,
    cameraRotationSpeedInput,
    cameraFovInput,
    cameraPositionXInput,
    cameraPositionYInput,
    cameraPositionZInput,
    cameraRotationPitchInput,
    cameraRotationYawInput
} = (() => ({
    dataDiv: document.getElementById('data')!,
    dataToggleButton: document.getElementById('data-toggle')!,
    startAlgorithmButton: document.getElementById('start-algorithm')!,
    mainDiv: document.getElementById('main')!,
    saveButton: document.getElementById('save')!,
    loadButton: document.getElementById('load')!,

    cameraPositionSpeedInput: document.getElementById(
        'camera-position-speed'
    ) as HTMLInputElement,
    cameraRotationSpeedInput: document.getElementById(
        'camera-rotation-speed'
    ) as HTMLInputElement,
    cameraFovInput: document.getElementById('camera-fov') as HTMLInputElement,
    cameraPositionXInput: document.getElementById(
        'camera-position-x'
    ) as HTMLInputElement,
    cameraPositionYInput: document.getElementById(
        'camera-position-y'
    ) as HTMLInputElement,
    cameraPositionZInput: document.getElementById(
        'camera-position-z'
    ) as HTMLInputElement,
    cameraRotationPitchInput: document.getElementById(
        'camera-rotation-pitch'
    ) as HTMLInputElement,
    cameraRotationYawInput: document.getElementById(
        'camera-rotation-yaw'
    ) as HTMLInputElement
}))();

let counter = 1;
const initThreeJS = () => {
    const { width, height } = mainDiv.getBoundingClientRect();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        config.value.fov,
        width / height,
        0.1,
        10000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mainDiv.appendChild(renderer.domElement);

    return { scene, camera, renderer };
};
const getConfig = () => {
    const _config: Config = {
        ...defaultConfig,
        cameraPosition: [...defaultConfig.cameraPosition],
        cameraRotation: [...defaultConfig.cameraRotation],
        gridResolution: { ...defaultConfig.gridResolution }
    };
    const reload = () => {
        setCameraPositionSpeed(_config.cameraPositionSpeed);
        setCameraRotationSpeed(_config.cameraRotationSpeed);
        setFOV(_config.fov);
        setCameraPosition(_config.cameraPosition);
        setCameraRotation(_config.cameraRotation);
    };
    const save = () => {
        localStorage.setItem('config', JSON.stringify(_config));
    };
    const load = () => {
        const config = JSON.parse(localStorage.getItem('config')!);
        for (const key in config) {
            _config[key as keyof typeof _config] = config[key];
        }
        reload();
    };
    const setCameraPositionSpeed = (speed: Config['cameraPositionSpeed']) => {
        _config.cameraPositionSpeed = speed;
        cameraPositionSpeedInput.value = `${speed}`;
    };
    const setCameraRotationSpeed = (speed: Config['cameraRotationSpeed']) => {
        _config.cameraRotationSpeed = speed;
        cameraRotationSpeedInput.value = `${speed}`;
    };
    const setFOV = (fov: Config['fov']) => {
        _config.fov = fov;
        cameraFovInput.value = `${_config.fov}`;
        camera.fov = _config.fov;
        camera.updateProjectionMatrix();
    };
    const setCameraPosition = ([x, y, z]: [
        x: number | undefined,
        y: number | undefined,
        z: number | undefined
    ]) => {
        if (x !== undefined) {
            _config.cameraPosition[0] = x;
            cameraPositionXInput.value = `${Math.trunc(x * 1000) / 1000}`;
            camera.position.setX(x);
        }
        if (y !== undefined) {
            _config.cameraPosition[1] = y;
            cameraPositionYInput.value = `${Math.trunc(y * 1000) / 1000}`;
            camera.position.setY(y);
        }
        if (z !== undefined) {
            _config.cameraPosition[2] = z;
            cameraPositionZInput.value = `${Math.trunc(z * 1000) / 1000}`;
            camera.position.setZ(z);
        }
    };
    const setCameraRotation = ([pitch, yaw]: [
        pitch: number | undefined,
        yaw: number | undefined
    ]) => {
        if (pitch !== undefined) {
            _config.cameraRotation[0] = pitch;
            cameraRotationPitchInput.value = `${Math.trunc(pitch * 1000) / 1000}`;
        }
        if (yaw !== undefined) {
            _config.cameraRotation[1] = yaw;
            cameraRotationYawInput.value = `${Math.trunc(yaw * 1000) / 1000}`;
        }
        camera.quaternion.setFromEuler(
            new THREE.Euler(
                pitch ?? _config.cameraRotation[0],
                yaw ?? _config.cameraRotation[1],
                0,
                'YXZ'
            )
        );
        renderer.render(scene, camera);
    };

    return {
        value: _config,
        reload,
        save,
        load,
        setCameraPositionSpeed,
        setCameraRotationSpeed,
        setFOV,
        setCameraPosition,
        setCameraRotation
    };
};
const setElementsEvent = () => {
    dataToggleButton.onclick = () => {
        if (dataDiv.style.height === '') {
            dataDiv.style.height = '2rem';
            dataDiv.style.overflow = 'hidden';
        } else {
            dataDiv.style.height = '';
            setTimeout(() => {
                dataDiv.style.overflow = '';
            }, 100);
        }
    };
    startAlgorithmButton.onclick = () => {
        const polygon = targetAreas[2].points;
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
                        (v, index) =>
                            Math.abs(v[i]) > zeroThreshold && index > i
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

        for (let i = minCV1; i < maxCV1; i += config.value.gridResolution.x) {
            const sign = cV2 > 0 ? 1 : -1;
            for (
                let j = 0;
                j < Math.abs(cV2) / config.value.gridResolution.y;
                j++
            ) {
                const firstPoint = sumVec(
                    sumVec(startPoint, multiplyVec(v1, i)),
                    multiplyVec(v2, j * sign * config.value.gridResolution.y)
                );
                const secondPoint = sumVec(
                    sumVec(
                        startPoint,
                        multiplyVec(v1, i + config.value.gridResolution.x)
                    ),
                    multiplyVec(v2, j * sign * config.value.gridResolution.y)
                );
                const cell: Point[] = [
                    firstPoint,
                    secondPoint,
                    sumVec(
                        secondPoint,
                        multiplyVec(v2, sign * config.value.gridResolution.y)
                    ),
                    sumVec(
                        firstPoint,
                        multiplyVec(v2, sign * config.value.gridResolution.y)
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
                    drawPoint(averagePoint, 0x00fff0);
                } else {
                    drawPoint(averagePoint, 0x0ffff00);
                }
            }
        }

        // const interval = setInterval(() => {
        //     window.open(
        //         `http://localhost:5173?start=${++counter}`,
        //         '_blank',
        //         'width=600,height=600'
        //     );
        //     if (counter >= 500) {
        //         clearInterval(interval);
        //     }
        // }, 40_000);
    };
    saveButton.onclick = () => {
        config.save();
    };
    loadButton.onclick = () => {
        config.load();
    };

    cameraPositionSpeedInput.onchange = ({ target }) => {
        config.setCameraPositionSpeed(
            Number((target as HTMLInputElement).value)
        );
    };
    cameraRotationSpeedInput.onchange = ({ target }) => {
        config.setCameraRotationSpeed(
            Number((target as HTMLInputElement).value)
        );
    };
    cameraFovInput.onchange = ({ target }) => {
        config.setFOV(Number((target as HTMLInputElement).value));
    };
    cameraPositionXInput.onchange = ({ target }) => {
        config.setCameraPosition([
            Number((target as HTMLInputElement).value),
            undefined,
            undefined
        ]);
    };
    cameraPositionYInput.onchange = ({ target }) => {
        config.setCameraPosition([
            undefined,
            Number((target as HTMLInputElement).value),
            undefined
        ]);
    };
    cameraPositionZInput.onchange = ({ target }) => {
        config.setCameraPosition([
            undefined,
            undefined,
            Number((target as HTMLInputElement).value)
        ]);
    };
    cameraRotationPitchInput.onchange = ({ target }) => {
        config.setCameraRotation([
            Number((target as HTMLInputElement).value),
            undefined
        ]);
    };
    cameraRotationYawInput.onchange = ({ target }) => {
        config.setCameraRotation([
            undefined,
            Number((target as HTMLInputElement).value)
        ]);
    };
};
const initCameraMovement = () => {
    const keysPressed = {
        w: false,
        a: false,
        s: false,
        d: false,
        q: false,
        e: false,
        arrowup: false,
        arrowdown: false,
        arrowleft: false,
        arrowright: false
    };

    document.addEventListener('keydown', ({ key }) => {
        const _key = key.toLowerCase();
        if (keysPressed[_key as keyof typeof keysPressed] !== undefined) {
            keysPressed[_key as keyof typeof keysPressed] = true;
        }
    });
    document.addEventListener('keyup', ({ key }) => {
        const _key = key.toLowerCase();
        if (keysPressed[_key as keyof typeof keysPressed] !== undefined) {
            keysPressed[_key as keyof typeof keysPressed] = false;
        }
    });
    window.addEventListener('resize', () => {
        const { width, height } = mainDiv.getBoundingClientRect();
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    });

    const animate = () => {
        requestAnimationFrame(animate);

        let positionChanged = false;
        if (keysPressed.w) {
            camera.translateZ(-config.value.cameraPositionSpeed);
            positionChanged = true;
        }
        if (keysPressed.s) {
            camera.translateZ(config.value.cameraPositionSpeed);
            positionChanged = true;
        }
        if (keysPressed.a) {
            camera.translateX(-config.value.cameraPositionSpeed);
            positionChanged = true;
        }
        if (keysPressed.d) {
            camera.translateX(config.value.cameraPositionSpeed);
            positionChanged = true;
        }
        if (keysPressed.q) {
            camera.translateY(-config.value.cameraPositionSpeed);
            positionChanged = true;
        }
        if (keysPressed.e) {
            camera.translateY(config.value.cameraPositionSpeed);
            positionChanged = true;
        }
        if (positionChanged) {
            config.setCameraPosition([
                camera.position.x,
                camera.position.y,
                camera.position.z
            ]);
        }

        if (keysPressed.arrowup) {
            config.setCameraRotation([
                Math.max(
                    -Math.PI / 2 + 0.1,
                    Math.min(
                        Math.PI / 2 - 0.1,
                        config.value.cameraRotation[0] +
                            config.value.cameraRotationSpeed
                    )
                ),
                undefined
            ]);
        }
        if (keysPressed.arrowdown) {
            config.setCameraRotation([
                Math.max(
                    -Math.PI / 2 + 0.1,
                    Math.min(
                        Math.PI / 2 - 0.1,
                        config.value.cameraRotation[0] -
                            config.value.cameraRotationSpeed
                    )
                ),
                undefined
            ]);
        }
        if (keysPressed.arrowleft) {
            config.setCameraRotation([
                undefined,
                config.value.cameraRotation[1] +
                    config.value.cameraRotationSpeed
            ]);
        }
        if (keysPressed.arrowright) {
            config.setCameraRotation([
                undefined,
                config.value.cameraRotation[1] -
                    config.value.cameraRotationSpeed
            ]);
        }

        renderer.render(scene, camera);
    };
    animate();
};
const drawPolygon = (points: Point[], color: number) => {
    const indices = Array(points.length - 2)
        .fill(undefined)
        .flatMap((_, i) => [0, i + 1, i + 2]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            new Float32Array(points.map(v => [v[1], v[2], v[0]]).flat()),
            3
        )
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
};
const drawCamera = (position: Camera['position']) =>
    drawPoint(position, 0x000099);
const drawPoint = ([x, y, z]: Point, color: number) => {
    const geometry = new THREE.SphereGeometry(0.05, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(y, z, x);
    scene.add(sphere);
};
const drawCircle = ([x, y, z]: Point, radius: number, color: number) => {
    const geometry = new THREE.CircleGeometry(radius, 32);
    const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide
    });
    const circle = new THREE.Mesh(geometry, material);
    circle.position.set(y, z, x);
    scene.add(circle);
};
const downloadJSON = (data: unknown, filename: string) => {
    const jsonString =
        typeof data === 'string' ? data : JSON.stringify(data, null, 4);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const config = getConfig();
const { scene, camera, renderer } = initThreeJS();
setElementsEvent();
initCameraMovement();
config.reload();

// scenarios
let colorCounter = 0x151515;
const getObstacleColor = () => {
    colorCounter += 0x050505;
    if (colorCounter > 0xaaaaaa) {
        colorCounter = 0x151515;
    }
    return colorCounter;
};
const getRandomNumber = (max: number) =>
    Math.trunc(Math.random() * max * 100) / 100;
const scenarioA = () => ({
    obstacles: [
        ...[
            {
                points: [
                    [0, 0, 3],
                    [6, 0, 3],
                    [6, 3, 3],
                    [0, 3, 3]
                ]
            },
            {
                points: [
                    [0, 0, 0],
                    [6, 0, 0],
                    [6, 3, 0],
                    [0, 3, 0]
                ]
            },
            {
                points: [
                    [0, 0, 0],
                    [0, 0, 3],
                    [6, 0, 3],
                    [6, 0, 0]
                ]
            },
            {
                points: [
                    [0, 3, 0],
                    [0, 3, 3],
                    [6, 3, 3],
                    [6, 3, 0]
                ]
            },
            {
                points: [
                    [0, 0, 0],
                    [0, 0, 3],
                    [0, 3, 3],
                    [0, 3, 0]
                ]
            },
            {
                points: [
                    [6, 0, 0],
                    [6, 0, 3],
                    [6, 3, 3],
                    [6, 3, 0]
                ]
            }
        ],
        ...[
            {
                points: [
                    [0, 1, 0],
                    [0, 1, 3],
                    [2, 1, 3],
                    [2, 1, 0]
                ]
            },
            {
                points: [
                    [0, 2, 0],
                    [0, 2, 3],
                    [2, 2, 3],
                    [2, 2, 0]
                ]
            },
            {
                points: [
                    [4, 1, 0],
                    [4, 1, 3],
                    [4, 3, 3],
                    [4, 3, 0]
                ]
            }
        ]
    ] as Obstacle[],
    targetAreas: [
        {
            points: [
                [1, 0.2, 0.7],
                [1, 0.2, 2.3],
                [1, 0.8, 2.3],
                [1, 0.8, 0.7]
            ],
            minAOV: 0,
            maxAOV: Math.PI / 3
        },
        {
            points: [
                [1, 1.2, 0.7],
                [1, 1.2, 2.3],
                [1, 1.8, 2.3],
                [1, 1.8, 0.7]
            ],
            minAOV: 0,
            maxAOV: Math.PI / 3
        },
        {
            points: [
                [1, 2.2, 1.7],
                [1, 2.2, 2.3],
                [1, 2.8, 1.9],
                [1, 2.8, 0.7]
            ],
            minAOV: 0,
            maxAOV: Math.PI / 3
        }
    ] as TargetArea[],
    cameras: [
        ...[
            {
                id: 1,
                position: [0.1, 0.1, 2.5],
                xyAngle: Math.PI * 1.84,
                xzAngle: Math.PI * 1.9,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 2,
                position: [0.1, 0.9, 2.9],
                xyAngle: Math.PI * 0.15,
                xzAngle: Math.PI * 1.9,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 3,
                position: [0.1, 1.1, 2.9],
                xyAngle: Math.PI * 0.15,
                xzAngle: Math.PI * 1.9,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 4,
                position: [0.1, 1.9, 2.9],
                xyAngle: Math.PI * 0.15,
                xzAngle: Math.PI * 1.9,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 5,
                position: [0.1, 2.1, 2.9],
                xyAngle: Math.PI * 0.15,
                xzAngle: Math.PI * 1.9,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 6,
                position: [0.1, 2.9, 2.9],
                xyAngle: Math.PI * 0.15,
                xzAngle: Math.PI * 1.9,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            }
        ],
        ...[
            {
                id: 7,
                position: [3.9, 2.9, 2.9],
                xyAngle: Math.PI / 2,
                xzAngle: Math.PI / 2,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 8,
                position: [3.9, 2, 2.9],
                xyAngle: (Math.PI * 5.4) / 4,
                xzAngle: Math.PI,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 9,
                position: [4.1, 1.1, 2.9],
                xyAngle: Math.PI / 2,
                xzAngle: Math.PI / 2,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 10,
                position: [4.1, 2.9, 2.9],
                xyAngle: Math.PI / 2,
                xzAngle: Math.PI / 2,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 11,
                position: [5.9, 2.9, 2.9],
                xyAngle: Math.PI / 2,
                xzAngle: Math.PI / 2,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            },
            {
                id: 12,
                position: [5.9, 0.1, 2.9],
                xyAngle: Math.PI / 2,
                xzAngle: Math.PI / 2,
                widthFov: Math.PI / 3,
                heightFov: Math.PI / 3
            }
        ]
    ] as Camera[]
});
const scenarioB = (
    width: number,
    height: number,
    obstaclesProbability: number,
    targetAreaProbability: number,
    cameraProbability: number
) => {
    const z = 3;

    // obstacles & targets
    const obstacles: Obstacle[] = [
        {
            points: [
                [0, 0, z],
                [width, 0, z],
                [width, height, z],
                [0, height, z]
            ]
        },
        {
            points: [
                [0, 0, 0],
                [width, 0, 0],
                [width, height, 0],
                [0, height, 0]
            ]
        },
        {
            points: [
                [0, 0, 0],
                [width, 0, 0],
                [width, 0, z],
                [0, 0, z]
            ]
        },
        {
            points: [
                [0, 0, 0],
                [0, height, 0],
                [0, height, z],
                [0, 0, z]
            ]
        },
        {
            points: [
                [0, height, 0],
                [width, height, 0],
                [width, height, z],
                [0, height, z]
            ]
        },
        {
            points: [
                [width, 0, 0],
                [width, height, 0],
                [width, height, z],
                [width, 0, z]
            ]
        }
    ];
    const targetAreas: TargetArea[] = [];
    for (let i = 0; i < width; i++) {
        for (let j = 1; j < height; j++) {
            if (Math.random() < obstaclesProbability) {
                obstacles.push({
                    points: [
                        [i + getRandomNumber(0.4), j, getRandomNumber(1)],
                        [i + getRandomNumber(0.4), j, z - getRandomNumber(1)],
                        [
                            i + 1 - getRandomNumber(0.4),
                            j,
                            z - getRandomNumber(1)
                        ],
                        [i + 1 - getRandomNumber(0.4), j, getRandomNumber(1)]
                    ]
                });
            } else if (Math.random() < targetAreaProbability) {
                targetAreas.push({
                    points: [
                        [i + getRandomNumber(0.4), j, getRandomNumber(1)],
                        [i + getRandomNumber(0.4), j, z - getRandomNumber(1)],
                        [
                            i + 1 - getRandomNumber(0.4),
                            j,
                            z - getRandomNumber(1)
                        ],
                        [i + 1 - getRandomNumber(0.4), j, getRandomNumber(1)]
                    ],
                    minAOV: 0,
                    maxAOV: Math.PI * (getRandomNumber(0.16667) + 0.25)
                });
            }
        }
    }
    for (let j = 0; j < height; j++) {
        for (let i = 1; i < width; i++) {
            if (Math.random() < obstaclesProbability) {
                obstacles.push({
                    points: [
                        [i, j + getRandomNumber(0.4), getRandomNumber(1)],
                        [i, j + getRandomNumber(0.4), z - getRandomNumber(1)],
                        [
                            i,
                            j + 1 - getRandomNumber(0.4),
                            z - getRandomNumber(1)
                        ],
                        [i, j + 1 - getRandomNumber(0.4), getRandomNumber(1)]
                    ]
                });
            } else if (Math.random() < targetAreaProbability) {
                targetAreas.push({
                    points: [
                        [i, j + getRandomNumber(0.4), getRandomNumber(1)],
                        [i, j + getRandomNumber(0.4), z - getRandomNumber(1)],
                        [
                            i,
                            j + 1 - getRandomNumber(0.4),
                            z - getRandomNumber(1)
                        ],
                        [i, j + 1 - getRandomNumber(0.4), getRandomNumber(1)]
                    ],
                    minAOV: 0,
                    maxAOV: Math.PI * (getRandomNumber(0.16667) + 0.25)
                });
            }
        }
    }

    // cameras
    const cameras: Camera[] = [];
    let cameraIdCounter = 0;
    for (let i = 1; i < width; i++) {
        for (let j = 1; j < height; j++) {
            for (const [xAdj, yAdj] of [
                [-0.1, -0.1],
                [-0.1, 0.1],
                [0.1, -0.1],
                [0.1, 0.1]
            ]) {
                for (const z of [0.9, 1.9, 2.9]) {
                    for (const [xyAngle, xzAngle] of [
                        ...Array(8)
                            .fill(0)
                            .map((_, i) => i / 4)
                            .flatMap(v =>
                                [7 / 4, 0, 1 / 4].map(_v => [
                                    v * Math.PI,
                                    _v * Math.PI
                                ])
                            ),
                        [0, 0],
                        [0, Math.PI]
                    ]) {
                        if (Math.random() > cameraProbability) {
                            continue;
                        }
                        cameras.push({
                            id: ++cameraIdCounter,
                            position: [i + xAdj, j + yAdj, z],
                            xyAngle,
                            xzAngle,
                            widthFov: Math.PI * 0.42,
                            heightFov: Math.PI * 0.42
                        });
                    }
                }
            }
        }
    }

    return { obstacles, targetAreas, cameras };
};

const { obstacles, targetAreas, cameras } = scenarioA();
// const { obstacles, targetAreas, cameras } = scenarioB(30, 30, 0.5, 0.05, 0.01);
obstacles.forEach(({ points }, index) => {
    if (index === 0) {
        return;
    }
    drawPolygon(points, getObstacleColor());
});
targetAreas.forEach(({ points }) => drawPolygon(points, 0xff0000));
Array.from(new Set(cameras.map(({ position: [x, y, z] }) => `${x}!${y}!${z}`)))
    .map(v => {
        const [x, y, z] = v.split('!');
        return [Number(x), Number(y), Number(z)] as Point;
    })
    .forEach(position => drawCamera(position));

// const states = [10, 15, 20, 25, 30, 35, 40, 45, 50].flatMap(size =>
//     [0.15, 0.2, 0.25, 0.3].flatMap(obstaclesProbability =>
//         [0.02, 0.03, 0.04, 0.05].flatMap(targetAreasProbability =>
//             [0.005, 0.008, 0.011, 0.015].flatMap(cameraProbability => ({
//                 size,
//                 obstaclesProbability,
//                 targetAreasProbability,
//                 cameraProbability
//             }))
//         )
//     )
// );
// const urlParams = new URLSearchParams(window.location.search);
// const temp = urlParams.get('start');
// const autoIndex = Number(temp);
// if (temp !== null && 0 <= autoIndex && autoIndex < states.length) {
//     const {
//         size,
//         obstaclesProbability,
//         targetAreasProbability,
//         cameraProbability
//     } = states[autoIndex];
//     console.log({
//         size,
//         obstaclesProbability,
//         targetAreasProbability,
//         cameraProbability
//     });
//     const { obstacles, targetAreas, cameras } = scenarioB(
//         size,
//         size,
//         obstaclesProbability,
//         targetAreasProbability,
//         cameraProbability
//     );
//
//     const result = await startAlgorithm(
//         config.value,
//         obstacles,
//         targetAreas,
//         cameras
//     );
//     downloadJSON(
//         '{' +
//             '"config":' +
//             JSON.stringify(result.config) +
//             ', "obstacles":' +
//             JSON.stringify(result.obstacles) +
//             ', "targetAreas":' +
//             JSON.stringify(result.targetAreas) +
//             ', "cells":' +
//             JSON.stringify(result.cells) +
//             ', "cameras":' +
//             JSON.stringify(result.cameras) +
//             ', "originalSize":' +
//             JSON.stringify(result.originalSize) +
//             ', "originalMatrix": {' +
//             Object.entries(result.originalMatrix)
//                 .map(([key, value]) => `"${key}": ${JSON.stringify(value)}`)
//                 .join(', ') +
//             '}, "problem":' +
//             JSON.stringify({
//                 size,
//                 obstaclesProbability,
//                 targetAreasProbability,
//                 cameraProbability
//             }) +
//             '}',
//         `problem-${autoIndex}.json`
//     );
//     window.close();
// }
// setTimeout(() => {
//     config.load();
// }, 100);

// const map = {};
// for (const cameraID in Out['optimizedMatrix']) {
//     if (
//         map[Object.keys(Out['optimizedMatrix'][cameraID]).length] === undefined
//     ) {
//         map[Object.keys(Out['optimizedMatrix'][cameraID]).length] = 0;
//     }
//     map[Object.keys(Out['optimizedMatrix'][cameraID]).length]++;
// }
// downloadJSON(
//     Object.entries(map)
//         .map(([key, value]) => `${key}, ${value}`)
//         .join('\n'),
//     'a.csv'
// );
// console.log(Object.keys(Out));
// console.log('originalSize: ', Out['originalSize']);
// console.log('optimizedSize: ', Out['optimizedSize']);
// console.log(Out['optimizedMatrix']);
