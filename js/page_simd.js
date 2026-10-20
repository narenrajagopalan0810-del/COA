/**
 * FlynnSim - SIMD Studio Controller (simd.html)
 * 
 * Drives the dedicated SIMD Vector & GPU Studio with lockstep broadcasting,
 * branch divergence predication masking, and vector memory bank inspection.
 */

document.addEventListener('DOMContentLoaded', () => {
    let peCount = 4;
    let arch = new SIMDArchitecture(peCount);
    let currentWorkload = null;
    let isRunning = false;
    let clockTimer = null;
    let clockHz = 4;

    const selectWorkload = document.getElementById('select-workload');
    const selectPeCount = document.getElementById('select-pe-count');
    const btnStep = document.getElementById('btn-step');
    const btnRun = document.getElementById('btn-run');
    const btnFast = document.getElementById('btn-fast');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');

    const metricCycles = document.getElementById('metric-cycles');
    const metricInstrs = document.getElementById('metric-instrs');
    const metricUtil = document.getElementById('metric-util');
    const metricDivergence = document.getElementById('metric-divergence');
    const statusBadge = document.getElementById('status-badge');

    const traceText = document.getElementById('live-trace-text');
    const schematicContainer = document.getElementById('simd-schematic-box');
    const peGridContainer = document.getElementById('simd-pe-grid');
    const divergenceMeterFill = document.getElementById('divergence-fill');
    const divergenceText = document.getElementById('divergence-text');

    function loadWorkload(type) {
        pause();
        if (type === 'vector_addition') {
            currentWorkload = WorkloadManager.createVectorAdditionWorkload(8, peCount);
        } else if (type === 'vector_addition_tail') {
            currentWorkload = WorkloadManager.createVectorAdditionWorkload(7, peCount); // non-multiple tail mask!
        } else if (type === 'matrix_mult') {
            currentWorkload = WorkloadManager.createMatrixMultiplicationWorkload(2, peCount);
        } else if (type === 'conditional_filter') {
            currentWorkload = WorkloadManager.createConditionalFilterWorkload(8, peCount);
        }

        arch.setPECount(peCount);
        arch.loadWorkload(currentWorkload);
        render();
    }

    function render() {
        const m = arch.getMetrics(arch.clockCycle);

        if (metricCycles) metricCycles.textContent = m.cycles;
        if (metricInstrs) metricInstrs.textContent = m.instructions;
        if (metricUtil) metricUtil.textContent = `${m.utilization}%`;
        if (metricDivergence) metricDivergence.textContent = `${arch.divergenceStalls} stalls`;

        if (statusBadge) {
            statusBadge.className = `arch-status-badge status-${arch.isHalted ? 'halted' : (arch.clockCycle > 0 ? 'running' : 'idle')}`;
            statusBadge.textContent = arch.isHalted ? 'HALTED' : (arch.clockCycle > 0 ? 'RUNNING' : 'IDLE');
        }

        if (traceText) traceText.textContent = arch.currentTrace || 'Cycle 0: SIMD array ready.';

        // Divergence meter calculation
        if (divergenceMeterFill && divergenceText) {
            const totalPeCycles = (arch.peCount * arch.clockCycle) || 1;
            const divergencePct = ((arch.divergenceStalls / totalPeCycles) * 100).toFixed(1);
            divergenceMeterFill.style.width = `${Math.min(100, divergencePct)}%`;
            divergenceText.textContent = `${arch.divergenceStalls} Mask Divergence Stalls (${divergencePct}% of PE time lost to branching)`;
        }

        // Render Schematic
        if (schematicContainer) {
            const masterInstr = arch.pes[0].currentInstruction ? arch.pes[0].currentInstruction.raw : 
                               (arch.isHalted ? 'HALT' : 'NOP');
            const activePEs = arch.pes.filter(p => p.mask && p.state !== PEState.HALTED).length;

            let peNodesHTML = '';
            arch.pes.forEach((pe) => {
                const isMasked = !pe.mask;
                peNodesHTML += `
                <div class="simd-pe-node ${isMasked ? 'pe-masked-out' : ''}" style="border: 1px ${isMasked ? 'dashed var(--c-border)' : 'solid var(--c-instr)'};">
                    <div class="node-header">
                        <span class="node-title">Core ${pe.id}</span>
                        <span class="mask-badge ${pe.mask ? 'mask-active' : 'mask-stalled'}">
                            ${pe.mask ? 'MASK=1 (EXEC)' : 'MASK=0 (STALL)'}
                        </span>
                    </div>
                    <div class="node-body">
                        <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                        <div class="reg-mini">R0:${pe.registers.R0} R1:${pe.registers.R1} R2:${pe.registers.R2}</div>
                        <div class="node-desc" style="font-size:10px;">${pe.lastOpDescription}</div>
                    </div>
                </div>
                `;
            });

            schematicContainer.innerHTML = `
                <div class="arch-schematic simd-schematic">
                    <div class="legend-bar">
                        <span class="legend-item"><span class="legend-dot dot-instr"></span> 1 Master Broadcast Instruction</span>
                        <span class="legend-item"><span class="legend-dot dot-data"></span> ${arch.peCount} Parallel Data Streams</span>
                        <span class="legend-item"><span class="legend-dot dot-mask"></span> Active: ${activePEs}/${arch.peCount}</span>
                    </div>

                    <div class="simd-master-cu-row" style="margin-top: 14px;">
                        <div class="hardware-block cu-block pulse-amber" style="width: 100%;">
                            <div class="block-header">
                                <span class="block-title">Master Control Unit (CU) &mdash; Master PC: ${arch.masterPC}</span>
                            </div>
                            <div class="broadcast-instr-banner" style="margin-top: 8px;">
                                <code>BROADCAST: ${masterInstr}</code>
                            </div>
                        </div>
                    </div>

                    <div class="broadcast-bus-container" style="margin: 10px 0;">
                        <div class="bus-line bus-instruction flow-active"></div>
                        <div class="bus-label">Lockstep Instruction Broadcast Bus to All ${arch.peCount} PEs</div>
                    </div>

                    <div class="simd-pes-array">
                        ${peNodesHTML}
                    </div>

                    <div class="simd-data-bus-row" style="margin-top: 12px;">
                        <div class="bus-line bus-data flow-active"></div>
                        <div class="bus-label">${arch.peCount} Parallel Data Memory Banks [Addr 10..99]</div>
                    </div>
                </div>
            `;
        }

        // Render detailed PE Cards
        if (peGridContainer) {
            peGridContainer.innerHTML = arch.pes.map(pe => `
                <div class="pe-stat-card ${!pe.mask ? 'pe-masked-out' : ''}">
                    <div class="pe-card-header">
                        <strong>PE ${pe.id}</strong>
                        <span class="mask-badge ${pe.mask ? 'mask-active' : 'mask-stalled'}">${pe.mask ? 'ACTIVE' : 'MASKED'}</span>
                    </div>
                    <div class="pe-card-body">
                        <div class="reg-table">
                            <div class="reg-cell"><span class="reg-name">R0:</span> <span class="reg-val">${pe.registers.R0}</span></div>
                            <div class="reg-cell"><span class="reg-name">R1:</span> <span class="reg-val">${pe.registers.R1}</span></div>
                            <div class="reg-cell"><span class="reg-name">R2:</span> <span class="reg-val">${pe.registers.R2}</span></div>
                            <div class="reg-cell"><span class="reg-name">R3:</span> <span class="reg-val">${pe.registers.R3}</span></div>
                        </div>
                        <div class="pe-card-util">
                            <span>Active: ${pe.activeCycles} cyc</span>
                            <span>Stalled: ${pe.stalledCycles} cyc</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    function step() {
        if (!arch.isHalted) {
            arch.step();
            render();
        } else {
            pause();
        }
    }

    function run() {
        if (isRunning) return;
        isRunning = true;
        updateRunButton();
        clockTimer = setInterval(() => {
            if (!arch.isHalted) {
                arch.step();
                render();
            } else {
                pause();
            }
        }, Math.floor(1000 / clockHz));
    }

    function pause() {
        isRunning = false;
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
        updateRunButton();
    }

    function updateRunButton() {
        if (btnRun) {
            btnRun.innerHTML = isRunning ? '<span>PAUSE</span>' : '<span>RUN</span>';
            btnRun.className = isRunning ? 'control-btn btn-warning' : 'control-btn btn-success';
        }
    }

    function runFast() {
        pause();
        let max = 5000;
        while (!arch.isHalted && max > 0) {
            arch.step();
            max--;
        }
        render();
    }

    if (btnStep) btnStep.addEventListener('click', step);
    if (btnRun) btnRun.addEventListener('click', () => isRunning ? pause() : run());
    if (btnFast) btnFast.addEventListener('click', runFast);
    if (btnReset) btnReset.addEventListener('click', () => loadWorkload(selectWorkload.value));

    if (selectWorkload) {
        selectWorkload.addEventListener('change', (e) => loadWorkload(e.target.value));
    }

    if (selectPeCount) {
        selectPeCount.addEventListener('change', (e) => {
            peCount = parseInt(e.target.value, 10);
            loadWorkload(selectWorkload.value);
        });
    }

    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            clockHz = parseInt(e.target.value, 10);
            if (speedValue) speedValue.textContent = `${clockHz} Hz`;
            if (isRunning) {
                pause();
                run();
            }
        });
    }

    loadWorkload('vector_addition');
});
