/**
 * FlynnSim - Application Controller & UI Coordinator
 * 
 * Binds UI inputs, controls, architecture switches, Amdahl sliders,
 * custom assembly editor, and automated verification alerts.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate core systems
    const sim = new SimulationController();
    const visualizer = new Visualizer(sim);
    const analytics = new AnalyticsManager(sim);

    // Initial default workload: Vector Addition (L=8, PEs=4)
    let currentWorkloadType = 'vector_addition';
    let currentVectorLength = 8;
    let currentMatrixDim = 2;

    function buildAndLoadWorkload() {
        let wl;
        if (currentWorkloadType === 'vector_addition') {
            wl = WorkloadManager.createVectorAdditionWorkload(currentVectorLength, sim.peCount);
        } else if (currentWorkloadType === 'matrix_mult') {
            wl = WorkloadManager.createMatrixMultiplicationWorkload(currentMatrixDim, sim.peCount);
        } else if (currentWorkloadType === 'conditional_filter') {
            wl = WorkloadManager.createConditionalFilterWorkload(currentVectorLength, sim.peCount);
        } else if (currentWorkloadType === 'stream_pipeline') {
            wl = WorkloadManager.createStreamPipelineWorkload(8);
        } else if (currentWorkloadType === 'ft_voting') {
            wl = WorkloadManager.createFaultTolerantVotingWorkload(6);
        }
        if (wl) {
            sim.loadWorkload(wl);
            updateWorkloadUI(wl);
        }
    }

    function updateWorkloadUI(wl) {
        const descEl = document.getElementById('workload-description');
        if (descEl) descEl.textContent = wl.description;

        const bannerTitle = document.getElementById('active-workload-title');
        if (bannerTitle) bannerTitle.textContent = wl.name;

        // Reset verification box
        const verifyBox = document.getElementById('verification-results-box');
        if (verifyBox) {
            verifyBox.className = 'verification-box pending';
            verifyBox.innerHTML = `<span>[STATUS: READY] Workload Loaded: <strong>${wl.name}</strong>. Step or Run simulation to verify outputs.</span>`;
        }
    }

    // Connect Simulation Callbacks
    sim.onCycleTick = (state) => {
        visualizer.render(state);
        analytics.updateCharts(state);
        updateControlButtons(state.isRunning);
    };

    sim.onSimulationHalt = (state) => {
        updateControlButtons(false);
        verifyWorkloadOutputs(state);
    };

    function verifyWorkloadOutputs(state) {
        const verifyBox = document.getElementById('verification-results-box');
        if (!verifyBox || !state.workload) return;

        // Verify SISD, SIMD, and MIMD outputs against expected ground truth
        const sisdVer = WorkloadManager.verifyOutput(sim.architectures.SISD, state.workload);
        const simdVer = WorkloadManager.verifyOutput(sim.architectures.SIMD, state.workload);
        const mimdVer = WorkloadManager.verifyOutput(sim.architectures.MIMD, state.workload);

        const allMatched = sisdVer.passed && simdVer.passed && mimdVer.passed;

        if (allMatched) {
            verifyBox.className = 'verification-box verified-success';
            verifyBox.innerHTML = `
                <div class="verify-header"><strong>[VERIFIED: BIT-EXACT MATCH ACROSS ALL ARCHITECTURES]</strong></div>
                <div class="verify-details">
                    <span>SISD Output: <code>[${sisdVer.actual.join(', ')}]</code></span><br>
                    <span>SIMD Output: <code>[${simdVer.actual.join(', ')}]</code></span><br>
                    <span>MIMD Output: <code>[${mimdVer.actual.join(', ')}]</code></span><br>
                    <small>All ${sisdVer.expected.length} memory locations strictly equal expected ground truth: <code>[${sisdVer.expected.join(', ')}]</code>.</small>
                </div>
            `;
        } else {
            verifyBox.className = 'verification-box verified-failure';
            verifyBox.innerHTML = `
                <div class="verify-header"><strong>[VERIFICATION NOTICE: ARCHITECTURAL DIVERGENCE]</strong></div>
                <div class="verify-details">
                    SISD: ${sisdVer.passed ? '[MATCH]' : '[MISMATCH]'} | 
                    SIMD: ${simdVer.passed ? '[MATCH]' : '[MISMATCH]'} | 
                    MIMD: ${mimdVer.passed ? '[MATCH]' : '[MISMATCH]'}
                </div>
            `;
        }
    }

    function updateControlButtons(isRunning) {
        const btnRun = document.getElementById('btn-run');
        if (btnRun) {
            btnRun.innerHTML = isRunning ? '<span>PAUSE</span>' : '<span>RUN</span>';
            btnRun.className = isRunning ? 'control-btn btn-warning' : 'control-btn btn-success';
        }
    }

    // --- Control Bar Event Handlers ---
    const btnStep = document.getElementById('btn-step');
    if (btnStep) btnStep.addEventListener('click', () => sim.step());

    const btnRun = document.getElementById('btn-run');
    if (btnRun) {
        btnRun.addEventListener('click', () => {
            if (sim.isRunning) {
                sim.pause();
                updateControlButtons(false);
            } else {
                sim.run();
                updateControlButtons(true);
            }
        });
    }

    const btnFast = document.getElementById('btn-fast-forward');
    if (btnFast) btnFast.addEventListener('click', () => sim.runFastToCompletion());

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            sim.reset();
            updateControlButtons(false);
        });
    }

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedValueLabel = document.getElementById('speed-value');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            const hz = parseInt(e.target.value, 10);
            sim.setClockSpeed(hz);
            if (speedValueLabel) speedValueLabel.textContent = `${hz} Hz`;
        });
    }

    // PE Count Selector
    const peSelect = document.getElementById('select-pe-count');
    if (peSelect) {
        peSelect.addEventListener('change', (e) => {
            const count = parseInt(e.target.value, 10);
            sim.setPECount(count);
            buildAndLoadWorkload();
        });
    }

    // Workload Selector
    const workloadSelect = document.getElementById('select-workload');
    const workloadParamRow = document.getElementById('workload-param-row');
    const workloadParamLabel = document.getElementById('workload-param-label');
    const workloadParamInput = document.getElementById('workload-param-input');

    if (workloadSelect) {
        workloadSelect.addEventListener('change', (e) => {
            currentWorkloadType = e.target.value;
            if (currentWorkloadType === 'vector_addition' || currentWorkloadType === 'conditional_filter') {
                if (workloadParamRow) workloadParamRow.style.display = 'flex';
                if (workloadParamLabel) workloadParamLabel.textContent = 'Array Size (L):';
                if (workloadParamInput) {
                    workloadParamInput.value = currentVectorLength;
                    workloadParamInput.min = 2;
                    workloadParamInput.max = 24;
                }
            } else if (currentWorkloadType === 'matrix_mult') {
                if (workloadParamRow) workloadParamRow.style.display = 'flex';
                if (workloadParamLabel) workloadParamLabel.textContent = 'Matrix Dim (NxN):';
                if (workloadParamInput) {
                    workloadParamInput.value = currentMatrixDim;
                    workloadParamInput.min = 2;
                    workloadParamInput.max = 4;
                }
            } else {
                if (workloadParamRow) workloadParamRow.style.display = 'none';
            }
            buildAndLoadWorkload();
        });
    }

    if (workloadParamInput) {
        workloadParamInput.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (currentWorkloadType === 'vector_addition' || currentWorkloadType === 'conditional_filter') {
                currentVectorLength = Math.max(2, Math.min(24, val));
            } else if (currentWorkloadType === 'matrix_mult') {
                currentMatrixDim = Math.max(2, Math.min(4, val));
            }
            buildAndLoadWorkload();
        });
    }

    // MIMD Memory Model Selector
    const mimdModelSelect = document.getElementById('select-mimd-model');
    if (mimdModelSelect) {
        mimdModelSelect.addEventListener('change', (e) => {
            sim.architectures.MIMD.setMemoryModel(e.target.value);
            buildAndLoadWorkload();
        });
    }

    // MISD Fault Injection Button
    const btnInjectFault = document.getElementById('btn-inject-fault');
    if (btnInjectFault) {
        btnInjectFault.addEventListener('click', () => {
            const misd = sim.architectures.MISD;
            if (misd.faultInjectedPE === 1) {
                misd.injectFault(-1);
                btnInjectFault.textContent = '⚡ Inject Fault on PE 1';
                btnInjectFault.classList.remove('btn-danger-active');
            } else {
                misd.injectFault(1);
                btnInjectFault.textContent = '❌ Fault Injected on PE 1 (Active)';
                btnInjectFault.classList.add('btn-danger-active');
            }
            sim.onCycleTick(sim.getAllMetrics());
        });
    }

    // Amdahl's Law Parallel Fraction Slider
    const amdahlSlider = document.getElementById('slider-amdahl-p');
    const amdahlLabel = document.getElementById('amdahl-p-value');
    if (amdahlSlider) {
        amdahlSlider.addEventListener('input', (e) => {
            const p = parseFloat(e.target.value);
            sim.setParallelFraction(p);
            if (amdahlLabel) {
                amdahlLabel.textContent = `Parallel: ${(p * 100).toFixed(0)}% | Serial: ${((1 - p) * 100).toFixed(0)}%`;
            }
            analytics.updateCharts(sim.getAllMetrics());
        });
    }

    // CSV Export
    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            analytics.exportCSV(sim.getAllMetrics());
        });
    }

    // View Navigation Tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    const viewSections = document.querySelectorAll('.view-section');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetView = tab.getAttribute('data-view');
            viewSections.forEach(sec => {
                if (sec.id === `view-${targetView}`) {
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                }
            });

            // If switching architecture views
            if (['all', 'sisd', 'simd', 'misd', 'mimd'].includes(targetView)) {
                sim.currentArchitectureKey = targetView.toUpperCase();
                sim.onCycleTick(sim.getAllMetrics());
            }
        });
    });

    // Custom Program Editor
    const btnAssembleCustom = document.getElementById('btn-assemble-custom');
    const customCodeArea = document.getElementById('custom-assembly-code');
    const customArchSelect = document.getElementById('custom-target-arch');
    const customEditorStatus = document.getElementById('custom-editor-status');

    if (btnAssembleCustom && customCodeArea) {
        btnAssembleCustom.addEventListener('click', () => {
            try {
                const code = customCodeArea.value;
                const parsed = TinyISA.assemble(code);
                const targetArch = customArchSelect ? customArchSelect.value : 'SISD';

                const customWorkload = {
                    id: 'custom_code',
                    name: `Custom Program (${targetArch})`,
                    description: `Custom user assembly code with ${parsed.instructions.length} instructions.`,
                    expectedOutput: null,
                    outputAddressBase: 0,
                    outputLength: 16,
                    initialMemory: new Array(256).fill(0),
                    sisdProgram: parsed,
                    simdProgram: parsed,
                    mimdPrograms: [parsed.instructions, parsed.instructions, parsed.instructions, parsed.instructions]
                };

                sim.loadWorkload(customWorkload);
                updateWorkloadUI(customWorkload);
                if (customEditorStatus) {
                    customEditorStatus.className = 'status-success';
                    customEditorStatus.textContent = `✓ Successfully assembled ${parsed.instructions.length} instructions! Loaded into ${targetArch}. Switch to Race or Architecture tab to run.`;
                }
            } catch (err) {
                if (customEditorStatus) {
                    customEditorStatus.className = 'status-error';
                    customEditorStatus.textContent = `Assembler Error: ${err.message}`;
                }
            }
        });
    }

    // Initialize First Run
    buildAndLoadWorkload();
});
