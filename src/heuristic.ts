import { readFileSync, writeFileSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';

type Matrix = Record<number, Record<number, boolean>>;

type Solution = {
    selectedCameras: number[];
    coveredCells: Set<number>;
    totalCameras: number;
};

type Chromosome = {
    genes: boolean[];
    fitness: number;
    isValid: boolean;
};

const getAllCells = (matrix: Matrix) =>
    Object.keys(matrix[Number(Object.keys(matrix)[0])])
        .map(Number)
        .sort((a, b) => a - b);

const getCameras = (matrix: Matrix) =>
    Object.keys(matrix)
        .map(Number)
        .sort((a, b) => a - b);

const getCoveredCells = (matrix: Matrix, camera: number) => {
    const covered: number[] = [];

    if (matrix[camera]) {
        for (const cell in matrix[camera]) {
            if (matrix[camera][Number(cell)]) {
                covered.push(Number(cell));
            }
        }
    }

    return covered;
};

const getCameraEfficiency = (
    matrix: Matrix,
    camera: number,
    uncoveredCells: Set<number>
) =>
    getCoveredCells(matrix, camera).filter(cell => uncoveredCells.has(cell))
        .length;

const getTopKCandidates = (
    matrix: Matrix,
    cameras: number[],
    uncoveredCells: Set<number>,
    k: number
): number[] => {
    const candidates: { camera: number; efficiency: number }[] = [];

    for (const camera of cameras) {
        const efficiency = getCameraEfficiency(matrix, camera, uncoveredCells);
        if (efficiency > 0) {
            candidates.push({ camera, efficiency });
        }
    }

    candidates.sort((a, b) => b.efficiency - a.efficiency);

    return candidates.slice(0, k).map(candidate => candidate.camera);
};

const randomizedGreedyBIP = (
    matrix: Matrix,
    randomnessFactor = 0.3
): Solution => {
    const cameras = getCameras(matrix);
    const allCells = getAllCells(matrix);
    const selectedCameras: number[] = [];
    const uncoveredCells = new Set<number>(allCells);
    const coveredCells = new Set<number>();

    const k = Math.max(1, Math.floor(cameras.length * randomnessFactor));

    while (uncoveredCells.size > 0) {
        const unselectedCameras = cameras.filter(
            cam => !selectedCameras.includes(cam)
        );

        if (unselectedCameras.length === 0) {
            break;
        }

        const topCandidates = getTopKCandidates(
            matrix,
            unselectedCameras,
            uncoveredCells,
            k
        );

        if (topCandidates.length === 0) {
            break;
        }

        const randomIndex = Math.floor(Math.random() * topCandidates.length);
        const selectedCamera = topCandidates[randomIndex];

        selectedCameras.push(selectedCamera);

        const newlyCovered = getCoveredCells(matrix, selectedCamera);
        newlyCovered.forEach(cell => {
            uncoveredCells.delete(cell);
            coveredCells.add(cell);
        });
    }

    return {
        selectedCameras,
        coveredCells,
        totalCameras: selectedCameras.length
    };
};

const isSolutionValid = (
    matrix: Matrix,
    solution: number[],
    allCells: number[]
): boolean => {
    const coveredCells = new Set<number>();

    for (const camera of solution) {
        const covered = getCoveredCells(matrix, camera);
        covered.forEach(cell => coveredCells.add(cell));
    }

    return allCells.every(cell => coveredCells.has(cell));
};

const localSearch = (
    matrix: Matrix,
    initialSolution: Solution,
    maxIterations: number = 100
): Solution => {
    const cameras = getCameras(matrix);
    const allCells = getAllCells(matrix);
    let currentSolution = {
        ...initialSolution,
        selectedCameras: [...initialSolution.selectedCameras]
    };
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 0; i < currentSolution.selectedCameras.length; i++) {
            const candidateForRemoval = [...currentSolution.selectedCameras];
            candidateForRemoval.splice(i, 1);

            if (isSolutionValid(matrix, candidateForRemoval, allCells)) {
                currentSolution.selectedCameras = candidateForRemoval;
                currentSolution.totalCameras = candidateForRemoval.length;
                improved = true;
                break;
            }
        }

        if (improved) {
            continue;
        }

        for (let i = 0; i < currentSolution.selectedCameras.length; i++) {
            for (
                let j = i + 1;
                j < currentSolution.selectedCameras.length;
                j++
            ) {
                for (const newCamera of cameras) {
                    if (currentSolution.selectedCameras.includes(newCamera)) {
                        continue;
                    }

                    const candidateSolution =
                        currentSolution.selectedCameras.filter(
                            (_, index) => index !== i && index !== j
                        );
                    candidateSolution.push(newCamera);

                    if (isSolutionValid(matrix, candidateSolution, allCells)) {
                        currentSolution.selectedCameras = candidateSolution;
                        currentSolution.totalCameras = candidateSolution.length;
                        improved = true;
                        break;
                    }
                }
                if (improved) {
                    break;
                }
            }
            if (improved) {
                break;
            }
        }
    }

    const finalCoveredCells = new Set<number>();
    for (const camera of currentSolution.selectedCameras) {
        const covered = getCoveredCells(matrix, camera);
        covered.forEach(cell => finalCoveredCells.add(cell));
    }
    currentSolution.coveredCells = finalCoveredCells;

    return currentSolution;
};

const greedyWithLocalSearch = (
    matrix: Matrix,
    maxLocalSearchIterations = 100
): Solution =>
    localSearch(matrix, greedyMethod(matrix), maxLocalSearchIterations);

const generateInitialSolution = (matrix: Matrix): Solution => {
    const cameras = getCameras(matrix);

    const selectedCameras = [...cameras];
    const coveredCells = new Set<number>();

    for (const camera of selectedCameras) {
        const covered = getCoveredCells(matrix, camera);
        covered.forEach(cell => coveredCells.add(cell));
    }

    return {
        selectedCameras,
        coveredCells,
        totalCameras: selectedCameras.length
    };
};

const generateNeighbor = (
    currentSolution: Solution,
    matrix: Matrix,
    allCells: number[]
): Solution => {
    const cameras = getCameras(matrix);
    const currentCameras = [...currentSolution.selectedCameras];

    // Randomly choose one of three neighborhood operations
    const operation = Math.floor(Math.random() * 3);

    let newCameras: number[] = [];

    main: {
        if (operation <= 0) {
            if (currentCameras.length > 1) {
                const randomIndex = Math.floor(
                    Math.random() * currentCameras.length
                );
                newCameras = currentCameras.filter(
                    (_, idx) => idx !== randomIndex
                );

                if (isSolutionValid(matrix, newCameras, allCells)) {
                    break main;
                }
            }
        }
        if (operation <= 1) {
            if (currentCameras.length > 0) {
                const randomIndex = Math.floor(
                    Math.random() * currentCameras.length
                );
                const availableCameras = cameras.filter(
                    cam => !currentCameras.includes(cam)
                );

                if (availableCameras.length > 0) {
                    const randomNewCamera =
                        availableCameras[
                            Math.floor(Math.random() * availableCameras.length)
                        ];
                    newCameras = [...currentCameras];
                    newCameras[randomIndex] = randomNewCamera;

                    if (isSolutionValid(matrix, newCameras, allCells)) {
                        break main;
                    }
                }
            }
        }
        if (operation <= 2) {
            const availableCameras = cameras.filter(
                cam => !currentCameras.includes(cam)
            );
            if (availableCameras.length > 0) {
                const randomCamera =
                    availableCameras[
                        Math.floor(Math.random() * availableCameras.length)
                    ];
                newCameras = [...currentCameras, randomCamera];
            } else {
                newCameras = currentCameras;
            }
        }
    }

    const newCoveredCells = new Set<number>();
    for (const camera of newCameras) {
        const covered = getCoveredCells(matrix, camera);
        covered.forEach(cell => newCoveredCells.add(cell));
    }

    return {
        selectedCameras: newCameras,
        coveredCells: newCoveredCells,
        totalCameras: newCameras.length
    };
};

const acceptanceProbability = (
    currentCost: number,
    newCost: number,
    temperature: number
): number => {
    if (newCost < currentCost) {
        return 1.0;
    }
    return Math.exp((currentCost - newCost) / temperature);
};

const isChromosomeValid = (
    matrix: Matrix,
    chromosome: boolean[],
    allCells: number[]
): boolean => {
    const coveredCells = new Set<number>();
    const cameras = getCameras(matrix);

    for (let i = 0; i < chromosome.length; i++) {
        if (chromosome[i]) {
            const camera = cameras[i];
            const covered = getCoveredCells(matrix, camera);
            covered.forEach(cell => coveredCells.add(cell));
        }
    }

    return allCells.every(cell => coveredCells.has(cell));
};

const calculateFitness = (chromosome: boolean[], isValid: boolean): number => {
    if (!isValid) {
        return 0;
    }

    const selectedCount = chromosome.filter(gene => gene).length;
    const totalCameras = chromosome.length;

    return totalCameras - selectedCount + totalCameras;
};

const createRandomChromosome = (length: number): boolean[] => {
    return Array.from({ length }, () => Math.random() > 0.7);
};

const initializePopulation = (
    matrix: Matrix,
    populationSize: number
): Chromosome[] => {
    const cameras = getCameras(matrix);
    const allCells = getAllCells(matrix);
    const population: Chromosome[] = [];

    for (let i = 0; i < populationSize; i++) {
        const genes = createRandomChromosome(cameras.length);
        const isValid = isChromosomeValid(matrix, genes, allCells);
        const fitness = calculateFitness(genes, isValid);

        population.push({ genes, fitness, isValid });
    }

    return population;
};

const selection = (population: Chromosome[]): Chromosome => {
    const tournamentSize = 3;
    let best: Chromosome =
        population[Math.floor(Math.random() * population.length)];

    for (let i = 1; i < tournamentSize; i++) {
        const candidate =
            population[Math.floor(Math.random() * population.length)];
        if (candidate.fitness > best.fitness) {
            best = candidate;
        }
    }

    return best;
};

const crossover = (parent1: Chromosome, parent2: Chromosome): Chromosome => {
    const childGenes: boolean[] = [];
    const crossoverPoint = Math.floor(Math.random() * parent1.genes.length);

    for (let i = 0; i < parent1.genes.length; i++) {
        if (i < crossoverPoint) {
            childGenes.push(parent1.genes[i]);
        } else {
            childGenes.push(parent2.genes[i]);
        }
    }

    return {
        genes: childGenes,
        fitness: 0,
        isValid: false
    };
};

const mutate = (chromosome: Chromosome, mutationRate: number): Chromosome => {
    const mutatedGenes = [...chromosome.genes];

    for (let i = 0; i < mutatedGenes.length; i++) {
        if (Math.random() < mutationRate) {
            mutatedGenes[i] = !mutatedGenes[i];
        }
    }

    return {
        genes: mutatedGenes,
        fitness: 0,
        isValid: false
    };
};

const chromosomeToSolution = (
    matrix: Matrix,
    chromosome: Chromosome
): Solution => {
    const cameras = getCameras(matrix);
    const selectedCameras: number[] = [];
    const coveredCells = new Set<number>();

    for (let i = 0; i < chromosome.genes.length; i++) {
        if (chromosome.genes[i]) {
            const camera = cameras[i];
            selectedCameras.push(camera);
            const covered = getCoveredCells(matrix, camera);
            covered.forEach(cell => coveredCells.add(cell));
        }
    }

    return {
        selectedCameras,
        coveredCells,
        totalCameras: selectedCameras.length
    };
};

// Methods
const greedyMethod = (matrix: Matrix): Solution => {
    const cameras = getCameras(matrix);
    const allCells = getAllCells(matrix);
    const selectedCameras: number[] = [];
    const uncoveredCells = new Set<number>(allCells);
    const coveredCells = new Set<number>();

    while (uncoveredCells.size > 0) {
        let bestCamera: number | null = null;
        let bestEfficiency = -1;

        for (const camera of cameras) {
            if (selectedCameras.includes(camera)) {
                continue;
            }

            const efficiency = getCameraEfficiency(
                matrix,
                camera,
                uncoveredCells
            );
            if (efficiency > bestEfficiency) {
                bestEfficiency = efficiency;
                bestCamera = camera;
            }
        }

        if (bestCamera === null) {
            break;
        }

        selectedCameras.push(bestCamera);

        const newlyCovered = getCoveredCells(matrix, bestCamera);
        newlyCovered.forEach(cell => {
            uncoveredCells.delete(cell);
            coveredCells.add(cell);
        });
    }

    return {
        selectedCameras,
        coveredCells,
        totalCameras: selectedCameras.length
    };
};

const multiStartRandomizedGreedyMethod = (
    matrix: Matrix,
    iterations = 10,
    randomnessFactor = 0.1
): Solution => {
    let bestSolution: Solution | null = null;

    for (let i = 0; i < iterations; i++) {
        const solution = randomizedGreedyBIP(matrix, randomnessFactor);

        if (
            !bestSolution ||
            solution.totalCameras < bestSolution.totalCameras
        ) {
            bestSolution = solution;
        }
    }

    return bestSolution!;
};

const multiStartGreedyWithLocalSearchMethod = (
    matrix: Matrix,
    iterations: number = 5
): Solution => {
    let bestSolution: Solution | null = null;

    for (let i = 0; i < iterations; i++) {
        const solution = greedyWithLocalSearch(matrix, 25 + i * 5);

        if (
            !bestSolution ||
            solution.totalCameras < bestSolution.totalCameras
        ) {
            bestSolution = solution;
        }
    }

    return bestSolution!;
};

const simulatedAnnealingMethod = (
    matrix: Matrix,
    initialTemperature = 1000,
    coolingRate = 0.95,
    minTemperature = 0.1,
    maxIterations = 80000
): Solution => {
    const allCells = getAllCells(matrix);
    let currentSolution = greedyMethod(matrix);
    let bestSolution = {
        ...currentSolution,
        selectedCameras: [...currentSolution.selectedCameras]
    };

    let temperature = initialTemperature;
    let iteration = 0;

    while (temperature > minTemperature && iteration < maxIterations) {
        const neighborSolution = generateNeighbor(
            currentSolution,
            matrix,
            allCells
        );

        const currentCost = currentSolution.selectedCameras.length;
        const neighborCost = neighborSolution.selectedCameras.length;

        if (
            acceptanceProbability(currentCost, neighborCost, temperature) >
            Math.random()
        ) {
            currentSolution = neighborSolution;

            if (
                neighborCost < bestSolution.totalCameras &&
                isSolutionValid(
                    matrix,
                    neighborSolution.selectedCameras,
                    allCells
                )
            ) {
                bestSolution = {
                    ...neighborSolution,
                    selectedCameras: [...neighborSolution.selectedCameras]
                };
            }
        }

        temperature *= coolingRate;
        iteration++;
    }

    return bestSolution;
};

// const adaptiveSimulatedAnnealingMethod = (
//     matrix: Matrix,
//     initialTemperature = 1000,
//     minTemperature = 0.1,
//     maxIterations = 20000
// ): Solution => {
//     const allCells = getAllCells(matrix);
//     let currentSolution = generateInitialSolution(matrix);
//     let bestSolution = {
//         ...currentSolution,
//         selectedCameras: [...currentSolution.selectedCameras]
//     };
//
//     let temperature = initialTemperature;
//     let iteration = 0;
//     let acceptCount = 0;
//
//     while (temperature > minTemperature && iteration < maxIterations) {
//         const neighborSolution = generateNeighbor(
//             currentSolution,
//             matrix,
//             allCells
//         );
//
//         const currentCost = currentSolution.selectedCameras.length;
//         const neighborCost = neighborSolution.selectedCameras.length;
//
//         const acceptProb = acceptanceProbability(
//             currentCost,
//             neighborCost,
//             temperature
//         );
//
//         if (acceptProb > Math.random()) {
//             currentSolution = neighborSolution;
//             acceptCount++;
//
//             if (
//                 neighborCost < bestSolution.totalCameras &&
//                 isSolutionValid(
//                     matrix,
//                     neighborSolution.selectedCameras,
//                     allCells
//                 )
//             ) {
//                 bestSolution = {
//                     ...neighborSolution,
//                     selectedCameras: [...neighborSolution.selectedCameras]
//                 };
//             }
//         }
//
//         const acceptanceRate = acceptCount / (iteration + 1);
//         let coolingRate = 0.95;
//
//         if (acceptanceRate < 0.1) {
//             coolingRate = 0.99;
//         } else if (acceptanceRate > 0.5) {
//             coolingRate = 0.9;
//         }
//
//         temperature *= coolingRate;
//         iteration++;
//     }
//
//     return bestSolution;
// };

const geneticAlgorithmMethod = (
    matrix: Matrix,
    populationSize = 20,
    generations = 100,
    crossoverRate = 0.9,
    mutationRate = 0.4,
    elitismCount = 20
): Solution => {
    const allCells = getAllCells(matrix);

    // Initialize population
    let population = initializePopulation(matrix, populationSize);

    let bestChromosome: Chromosome = population[0];

    for (let generation = 0; generation < generations; generation++) {
        population.forEach(chromosome => {
            chromosome.isValid = isChromosomeValid(
                matrix,
                chromosome.genes,
                allCells
            );
            chromosome.fitness = calculateFitness(
                chromosome.genes,
                chromosome.isValid
            );
        });

        population.sort((a, b) => b.fitness - a.fitness);

        if (
            population[0].fitness > bestChromosome.fitness &&
            population[0].isValid
        ) {
            bestChromosome = {
                ...population[0],
                genes: [...population[0].genes]
            };
        }

        const newPopulation: Chromosome[] = [];

        for (let i = 0; i < elitismCount; i++) {
            newPopulation.push({
                ...population[i],
                genes: [...population[i].genes]
            });
        }

        while (newPopulation.length < populationSize) {
            const parent1 = selection(population);
            const parent2 = selection(population);

            let child: Chromosome;

            if (Math.random() < crossoverRate) {
                child = crossover(parent1, parent2);
            } else {
                child = { ...parent1, genes: [...parent1.genes] };
            }

            child = mutate(child, mutationRate);
            newPopulation.push(child);
        }

        population = newPopulation;

        // Adaptive mutation rate
        if (generation % 50 === 0 && generation > 0) {
            mutationRate = Math.max(0.01, mutationRate * 0.95);
        }
    }

    population.forEach(chromosome => {
        chromosome.isValid = isChromosomeValid(
            matrix,
            chromosome.genes,
            allCells
        );
        chromosome.fitness = calculateFitness(
            chromosome.genes,
            chromosome.isValid
        );
    });

    population.sort((a, b) => b.fitness - a.fitness);

    let finalBest = bestChromosome;
    for (const chromosome of population) {
        if (chromosome.isValid && chromosome.fitness > finalBest.fitness) {
            finalBest = chromosome;
        }
    }

    return chromosomeToSolution(matrix, finalBest);
};

// const enhancedGeneticAlgorithmMethod = (
//     matrix: Matrix,
//     populationSize = 100,
//     generations = 500
// ): Solution => {
//     const cameras = getCameras(matrix);
//     const allCells = getAllCells(matrix);
//
//     let population = initializePopulation(matrix, populationSize);
//     let bestChromosome: Chromosome = population[0];
//
//     for (let generation = 0; generation < generations; generation++) {
//         population.forEach(chromosome => {
//             chromosome.isValid = isChromosomeValid(
//                 matrix,
//                 chromosome.genes,
//                 allCells
//             );
//             chromosome.fitness = calculateFitness(
//                 chromosome.genes,
//                 chromosome.isValid
//             );
//         });
//
//         population.sort((a, b) => b.fitness - a.fitness);
//
//         if (
//             population[0].fitness > bestChromosome.fitness &&
//             population[0].isValid
//         ) {
//             bestChromosome = {
//                 ...population[0],
//                 genes: [...population[0].genes]
//             };
//         }
//
//         const newPopulation: Chromosome[] = [];
//
//         // Elitism
//         for (let i = 0; i < 3; i++) {
//             newPopulation.push({
//                 ...population[i],
//                 genes: [...population[i].genes]
//             });
//         }
//
//         // Diversity: add some random chromosomes
//         for (let i = 0; i < 5; i++) {
//             const randomGenes = createRandomChromosome(cameras.length);
//             const isValid = isChromosomeValid(matrix, randomGenes, allCells);
//             const fitness = calculateFitness(randomGenes, isValid);
//             newPopulation.push({ genes: randomGenes, fitness, isValid });
//         }
//
//         // Crossover and mutation for rest
//         while (newPopulation.length < populationSize) {
//             const parent1 = selection(population);
//             const parent2 = selection(population);
//
//             let child = crossover(parent1, parent2);
//             child = mutate(child, 0.15); // Higher mutation for diversity
//
//             newPopulation.push(child);
//         }
//
//         population = newPopulation;
//     }
//
//     let finalBest = bestChromosome;
//     for (const chromosome of population) {
//         if (chromosome.isValid && chromosome.fitness > finalBest.fitness) {
//             finalBest = chromosome;
//         }
//     }
//
//     return chromosomeToSolution(matrix, finalBest);
// };

const stall = () =>
    new Promise(resolve => {
        setTimeout(() => resolve(undefined), 1000);
    });
(async () => {
    let start;
    await appendFile(
        'output.csv',
        'originalCameraSize, originalCellSize, optimizedCameraSize, optimizedCellSize, ' +
            'originalGreedyMethodTime, originalGreedyMethodCount, ' +
            'originalMultiStartRandomizedGreedyMethodTime, originalMultiStartRandomizedGreedyMethodCount, ' +
            'originalMultiStartGreedyWithLocalSearchMethodTime, originalMultiStartGreedyWithLocalSearchMethodCount, ' +
            'originalSimulatedAnnealingMethodTime, originalSimulatedAnnealingMethodCount, ' +
            'originalGeneticAlgorithmMethodTime, originalGeneticAlgorithmMethodCount, ' +
            'optimizedGreedyMethodTime, optimizedGreedyMethodCount, ' +
            'optimizedMultiStartRandomizedGreedyMethodTime, optimizedMultiStartRandomizedGreedyMethodCount, ' +
            'optimizedMultiStartGreedyWithLocalSearchMethodTime, optimizedMultiStartGreedyWithLocalSearchMethodCount, ' +
            'optimizedSimulatedAnnealingMethodTime, optimizedSimulatedAnnealingMethodCount, ' +
            'optimizedGeneticAlgorithmMethodTime, optimizedGeneticAlgorithmMethodCount' +
            '\n'
    );

    for (let i = 138; i <= 250; i++) {
        console.log(i);

        const optimizedMatrix = JSON.parse(
            readFileSync(`.\\problem\\problem-${i}-optimized.json`, 'utf8')
        );
        const { originalMatrix } = JSON.parse(
            readFileSync(`.\\problem\\problem-${i}.json`, 'utf8')
        );

        const cameraIDs = Object.keys(originalMatrix).map(Number);
        const cellIDs = Object.keys(originalMatrix[cameraIDs[0]]).map(Number);
        const codes = cellIDs.map(byID => {
            let code = '';
            cameraIDs.forEach(otherID => {
                if (originalMatrix[otherID][byID]) {
                    code += '1';
                } else {
                    code += '0';
                }
            });
            return { id: byID, code };
        });
        const removingByIDs: number[] = [];
        for (let i = 0; i < codes.length; i++) {
            if (removingByIDs.includes(codes[i].id)) {
                continue;
            }
            if (!codes[i].code.includes('1')) {
                removingByIDs.push(codes[i].id);
            }
        }
        removingByIDs.forEach(byID => {
            cameraIDs.forEach(cameraID => {
                delete originalMatrix[cameraID][byID];
            });
        });

        await appendFile(
            'output.csv',
            Object.keys(originalMatrix).length +
                ', ' +
                Object.keys(originalMatrix[Object.keys(originalMatrix)[0]])
                    .length +
                ', ' +
                Object.keys(optimizedMatrix).length +
                ', ' +
                Object.keys(optimizedMatrix[Object.keys(optimizedMatrix)[0]])
                    .length
        );
        await stall();
        for (const matrix of [originalMatrix, optimizedMatrix]) {
            // console.info('START greedyMethod');s
            start = performance.now();
            const greedyMethodResponse = greedyMethod(matrix);
            await appendFile(
                'output.csv',
                `, ${Math.trunc(performance.now() - start)}, ${greedyMethodResponse.selectedCameras.length}`
            );
            // console.info(
            //     `END greedyMethod ${Math.trunc((performance.now() - start) / 1000)}s, cameras: ${greedyMethodResponse.selectedCameras.length}`
            // );
            // writeFileSync(
            //     'greedyMethod.json',
            //     JSON.stringify(greedyMethodResponse, null, 4)
            // );

            await stall();
            // console.info('START multiStartRandomizedGreedyMethod ');
            start = performance.now();
            const multiStartRandomizedGreedyMethodResponse =
                multiStartRandomizedGreedyMethod(matrix);
            await appendFile(
                'output.csv',
                `, ${Math.trunc(performance.now() - start)}, ${multiStartRandomizedGreedyMethodResponse.selectedCameras.length}`
            );
            // console.info(
            //     `END multiStartRandomizedGreedyMethod ${Math.trunc((performance.now() - start) / 1000)}s, cameras: ${multiStartRandomizedGreedyMethodResponse.selectedCameras.length}`
            // );
            // writeFileSync(
            //     'multiStartRandomizedGreedyMethod.json',
            //     JSON.stringify(
            //         multiStartRandomizedGreedyMethodResponse,
            //         null,
            //         4
            //     )
            // );

            await stall();
            // console.info('START multiStartGreedyWithLocalSearchMethod');
            start = performance.now();
            const multiStartGreedyWithLocalSearchMethodResponse =
                multiStartGreedyWithLocalSearchMethod(matrix);
            await appendFile(
                'output.csv',
                `, ${Math.trunc(performance.now() - start)}, ${multiStartGreedyWithLocalSearchMethodResponse.selectedCameras.length}`
            );
            // console.info(
            //     `END multiStartGreedyWithLocalSearchMethod ${Math.trunc((performance.now() - start) / 1000)}s, cameras: ${multiStartGreedyWithLocalSearchMethodResponse.selectedCameras.length}`
            // );
            // writeFileSync(
            //     'multiStartGreedyWithLocalSearchMethod.json',
            //     JSON.stringify(
            //         multiStartGreedyWithLocalSearchMethodResponse,
            //         null,
            //         4
            //     )
            // );

            await stall();
            // console.info('START simulatedAnnealingMethod');
            start = performance.now();
            const simulatedAnnealingMethodResponse =
                simulatedAnnealingMethod(matrix);
            await appendFile(
                'output.csv',
                `, ${Math.trunc(performance.now() - start)}, ${simulatedAnnealingMethodResponse.selectedCameras.length}`
            );
            // console.info(
            //     `END simulatedAnnealingMethod ${Math.trunc((performance.now() - start) / 1000)}s, cameras: ${simulatedAnnealingMethodResponse.selectedCameras.length}`
            // );
            // writeFileSync(
            //     'simulatedAnnealingMethod.json',
            //     JSON.stringify(simulatedAnnealingMethodResponse, null, 4)
            // );

            await stall();
            // console.info('START geneticAlgorithmMethod ');
            start = performance.now();
            const geneticAlgorithmMethodResponse =
                geneticAlgorithmMethod(matrix);
            await appendFile(
                'output.csv',
                `, ${Math.trunc(performance.now() - start)}, ${geneticAlgorithmMethodResponse.selectedCameras.length}`
            );
            // console.info(
            //     `END geneticAlgorithmMethod ${Math.trunc((performance.now() - start) / 1000)}s, cameras: ${geneticAlgorithmMethodResponse.selectedCameras.length}`
            // );
            // writeFileSync(
            //     'geneticAlgorithmMethod.json',
            //     JSON.stringify(geneticAlgorithmMethodResponse, null, 4)
            // );

            if (matrix === optimizedMatrix) {
                writeFileSync(
                    `C:\\Users\\MRNafisiA\\Downloads\\problem\\problem-${i}-solution.json`,
                    JSON.stringify({
                        greedyMethodResponse,
                        multiStartRandomizedGreedyMethodResponse,
                        multiStartGreedyWithLocalSearchMethodResponse,
                        simulatedAnnealingMethodResponse,
                        geneticAlgorithmMethodResponse
                    })
                );
            }
        }

        await appendFile('output.csv', `\n`);
    }
})();
