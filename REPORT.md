# FlynnSim: Design and Implementation of an Interactive Computer Architecture Simulator for Flynn's Taxonomy
## Academic Project Report & Viva Reference Document

---

### Abstract
Understanding the trade-offs in modern computer organization requires hands-on exploration of instruction streams, data paths, and synchronization overheads. **FlynnSim** is a cycle-accurate, browser-based simulation platform developed to model and contrast Michael J. Flynn's four classic architectural paradigms: **SISD**, **SIMD**, **MISD**, and **MIMD**. This report outlines the theoretical foundation, microarchitectural design, software implementation, experimental results, and analytical evaluation (including Amdahl's Law and memory contention models) of the simulator.

---

## 1. Introduction
Modern computing encompasses diverse processing paradigms ranging from ultra-low-power embedded microcontrollers (SISD) to massively parallel graphics processing units (SIMD), fault-tolerant aerospace voting systems (MISD), and multi-socket high-performance compute clusters (MIMD). 

Traditional computer architecture education often introduces Flynn's classification abstractly using static 2x2 diagrams. Students frequently struggle to grasp:
- How SIMD lockstep execution degrades when conditional branches introduce **mask divergence**.
- Why pure **MISD** machines are rare in general computing, yet critical in fault-tolerant avionics and systolic pipelines.
- How **bus arbitration and contention** limit shared-memory MIMD scaling compared to distributed clusters.

**FlynnSim** was created to bridge this pedagogical gap through a self-contained, interactive, cycle-accurate simulation environment.

---

## 2. Background: Flynn's Taxonomy (1966)
Michael J. Flynn categorized computing systems along two orthogonal axes:
1. **Multiplicity of Instruction Streams** ($SI$ vs $MI$)
2. **Multiplicity of Data Streams** ($SD$ vs $MD$)

$$\begin{array}{|c|c|c|}
\hline
\textbf{Taxonomy} & \textbf{Single Data (SD)} & \textbf{Multiple Data (MD)} \\
\hline
\textbf{Single Instruction (SI)} & \textbf{SISD} \text{ (Von Neumann Uniprocessors)} & \textbf{SIMD} \text{ (Vector Units / GPUs)} \\
\hline
\textbf{Multiple Instruction (MI)} & \textbf{MISD} \text{ (Pipelined Systolic / TMR)} & \textbf{MIMD} \text{ (Multicores / Clusters)} \\
\hline
\end{array}$$

### 2.1 SISD (Single Instruction, Single Data)
- **Model**: A single Central Processing Unit executes one instruction stream sequentially against a single memory space.
- **Examples**: Classic Intel 8086, Motorola 68000, basic ARM Cortex-M0 microcontrollers.
- **Characteristics**: Deterministic and simple, but bounded by the memory wall and instruction-level parallelism limits.

### 2.2 SIMD (Single Instruction, Multiple Data)
- **Model**: A single master Control Unit broadcasts the identical instruction opcode to an array of $N$ Processing Elements (PEs) executing in lockstep. Each PE applies the operation to its private data register or memory offset.
- **Examples**: NVIDIA CUDA streaming multiprocessors (warps), Intel AVX-512, ARM Neon, Cray-1.
- **Predication & Divergence**: When conditional branches occur (`if (cond) A else B`), SIMD hardware cannot branch independently. It evaluates a predicate mask, executes block `A` with non-qualifying PEs disabled, inverts the mask, and executes block `B`. This divergence penalty halves theoretical throughput on divergent branches.

### 2.3 MISD (Multiple Instruction, Single Data)
- **Model**: Multiple independent instruction streams operate concurrently on a shared or sequential data stream.
- **Why rare in commercial systems?** Most computational tasks either parallelize data items (SIMD) or divide independent tasks across separate datasets (MIMD).
- **Practical Realizations**:
  1. *Systolic / Stream Pipelines*: In digital signal processing, cryptographic accelerators, and neural tensor units, a stream of tokens flows sequentially through specialized PEs.
  2. *Triple Modular Redundancy (TMR)*: Spacecraft (e.g., Space Shuttle flight computers, satellite avionics) broadcast sensor telemetry to 3 diverse PEs executing redundant algorithms. A hardware majority voter masks single-event upsets (radiation bit-flips).

### 2.4 MIMD (Multiple Instruction, Multiple Data)
- **Model**: $N$ autonomous processing elements, each equipped with its own Control Unit, Program Counter, and ALU, executing asynchronous instruction streams on independent datasets.
- **Architectural Variants**:
  - *Symmetric Multiprocessing (SMP / Shared Memory)*: All cores share a unified memory bus. Vulnerable to memory contention and bus saturation as core count increases.
  - *Distributed Memory (Clusters / MPPs)*: Each core has private memory; communication occurs via explicit message passing (MPI). Highly scalable to thousands of nodes.

---

## 3. Simulator Architecture & Design

### 3.1 Simulated Microarchitecture
Each simulated Processing Element (PE) contains:
- **Registers**: General-purpose registers `R0`, `R1`, `R2`, `R3`.
- **Status Registers**: Program Counter (`PC`), Zero Flag (`ZF`), Less-Than (`LT`), Greater-Than (`GT`).
- **SIMD Predicate Mask**: Boolean flag determining active vs masked-off execution.
- **Cycle-Accurate Latencies**:
  - ALU Add/Sub/Cmp: 1 cycle.
  - Multiplier: 2 cycles.
  - Memory Load/Store: 2 cycles (address calculation + bus transfer).

### 3.2 TinyISA Instruction Set Architecture
```
LOAD Rd, [Addr]         ; 2 cycles (Memory -> Register)
LOAD Rd, #imm           ; 1 cycle  (Immediate -> Register)
STORE [Addr], Rs        ; 2 cycles (Register -> Memory)
ADD Rd, Rs, Rt          ; 1 cycle  (ALU Rd = Rs + Rt)
SUB Rd, Rs, Rt          ; 1 cycle  (ALU Rd = Rs - Rt)
MUL Rd, Rs, Rt          ; 2 cycles (ALU Rd = Rs * Rt)
CMP Rs, Rt              ; 1 cycle  (Sets condition flags)
JMP / BEQ / BNE / BGT   ; 1 cycle  (Branching)
MASK_EVAL cond          ; 1 cycle  (SIMD predication)
MASK_INVERT             ; 1 cycle  (SIMD branch inversion)
MASK_RESET              ; 1 cycle  (SIMD mask reset)
HALT                    ; 1 cycle  (Terminates execution)
```

### 3.3 Bus Contention Arbiter (MIMD Shared Memory)
In shared-memory mode, if $K$ PEs issue simultaneous memory access (`LOAD` or `STORE`), the **Round-Robin Arbiter** grants bus access to exactly one PE. The remaining $K-1$ PEs are placed into `PEState.STALLED_BUS`, accurately reflecting physical hardware serialization.

---

## 4. Workloads & Empirical Results

### 4.1 Workload 1: Vector Addition ($C = A + B$, Length $L = 8$, PEs $N = 4$)
| Metric | SISD | SIMD ($N=4$) | MIMD ($N=4$, SMP) | MISD (Pipeline) |
| :--- | :---: | :---: | :---: | :---: |
| **Total Cycles ($T$)** | 81 | 24 | 38 | 26 |
| **Speedup ($S$)** | $1.00\times$ | **$3.38\times$** | **$2.13\times$** | $3.12\times$ |
| **PE Utilization (%)** | 100.0% | 85.4% | 61.2% | 69.2% |
| **Efficiency ($E = S/N$)** | 100.0% | 84.5% | 53.3% | 78.0% |
| **Correctness** | Verified [8..64] | Verified [8..64] | Verified [8..64] | N/A |

**Key Finding**: SIMD achieves superior speedup ($3.38\times$) on uniform data-parallel tasks due to zero bus arbitration overhead. Shared-memory MIMD experiences memory bus contention when threads concurrently write back results.

### 4.2 Workload 2: Conditional Filter Divergence ($L = 8$, PEs $N = 4$)
Evaluating: `if (A[i] > 10) A[i]*2 else A[i]+5`
- **SISD**: 88 cycles.
- **SIMD**: 46 cycles (Recorded **40 PE-cycles lost to mask divergence stalls**).
- **MIMD**: 39 cycles (Cores branch independently without stalling each other).

**Key Finding**: In branch-heavy code, SIMD hardware efficiency drops significantly because both branch paths must be serialized across all PEs. MIMD handles asynchronous branches naturally.

---

## 5. Analytical Evaluation: Amdahl's Law vs Gustafson's Law

### 5.1 Amdahl's Law (Strong Scaling)
Amdahl's law governs speedup when problem size is fixed:
$$S(N) = \frac{1}{(1 - p) + \frac{p}{N}} = \frac{1}{s + \frac{1 - s}{N}}$$
Where $p$ is the parallel fraction and $s = 1 - p$ is the strictly serial fraction.

**Implication demonstrated in FlynnSim**:
- At $s = 15\%$, maximum theoretical speedup is strictly bounded by $S_{\max} = \frac{1}{0.15} = 6.67\times$, even with an infinite number of PEs.
- FlynnSim overlays this theoretical curve directly on top of empirical simulation measurements, illustrating the diminishing returns of core scaling.

---

## 6. Limitations & Future Work
1. **Cache Hierarchy**: Currently, memory access operates on a unified single-cycle or two-cycle bus without multi-level L1/L2/L3 caches or cache coherence snooping protocols (MESI). Adding MESI bus sniffing would be a valuable extension.
2. **Superscalar Pipeline**: PEs currently execute in discrete multi-cycle states rather than a deep 5-stage classic RISC pipeline (IF, ID, EX, MEM, WB). Implementing branch prediction and forwarding would enhance SISD modeling.

---

## 7. Conclusion
FlynnSim delivers a pedagogically sound, cycle-accurate simulation tool for computer architecture education. By grounding abstract taxonomy classifications in concrete instruction sequences, register files, and bus contention models, students gain an intuitive, mathematically verified appreciation of the architectural trade-offs defining modern computing systems.

---

## 8. Viva Examination Preparation Q&A

**Q1: Why does SIMD perform better than MIMD on Vector Addition in our simulation?**
> *Answer*: SIMD uses a single broadcast control unit and parallel memory banks, avoiding control instruction overhead and shared-bus contention. In shared-memory MIMD, multiple cores compete for the central memory bus during concurrent stores, introducing bus stall cycles.

**Q2: What is SIMD branch divergence, and how is it demonstrated in FlynnSim?**
> *Answer*: Because a SIMD processor has only one instruction sequencer broadcasting to all PEs, it cannot execute two branches at once. PEs failing the `if` condition are masked off (`MASK_EVAL`), idling while the `THEN` block executes, and vice-versa (`MASK_INVERT`). FlynnSim visually highlights these idle PEs in red and records cumulative divergence stall cycles.

**Q3: Why is MISD considered rare in practice?**
> *Answer*: General-purpose applications rarely require multiple distinct operations performed simultaneously on the exact same piece of data. Real-world uses are restricted to pipelined stream processing (systolic arrays) and fault-tolerant redundant voting (Space Shuttle TMR), both of which are implemented in FlynnSim.

**Q4: How does FlynnSim handle vector lengths that are not multiples of the PE count?**
> *Answer*: FlynnSim utilizes **tail predication masking** (`MASK_EVAL PE_LT #rem`). On the final chunk, only PEs whose IDs are less than the remaining elements remain active; the remainder are safely masked off to prevent memory out-of-bounds errors.
