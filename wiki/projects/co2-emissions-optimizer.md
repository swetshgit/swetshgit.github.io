# CO2 emissions: a CUDA preprocessing exercise

*Exploring custom CUDA kernels for the sliding-window preprocessing used by a vehicle CO2 prediction pipeline built around CNN-GRU and LSTM models.*

## Project context and attribution

The original CO2 prediction models were developed as a **team effort for the CS7643 Deep Learning Final Project at Georgia Tech (GaTech)**. The original model implementations are not committed to the public repository to preserve the team's intellectual property. Selected training/testing sections and results can be retained through the repository's notebook sanitization workflow.

This article focuses on my CUDA preprocessing exercise around that project. The snippets below are CUDA-oriented pseudocode explaining the GPU work; they do not reproduce the team's model architectures or training implementations.

## Why preprocessing matters

The prediction task uses vehicle time-series measurements to estimate CO2 emissions. The configured EnviroCar features include speed, RPM, fuel consumption, throttle position, engine load, intake temperature, and GPS-related measurements. The target is CO2 in kilograms per hour.

A sequence model consumes windows of consecutive observations rather than isolated rows. Constructing those windows repeatedly slices and copies overlapping sections of the same input. The CUDA exercise moves this independent copy work onto the GPU while preserving the window-to-target relationship.

For an input with `T` timesteps, `F` features, and a window length `L`, the transformation is:

| Tensor | Shape | Meaning |
| --- | --- | --- |
| Input | `T × F` | Chronological feature observations |
| Windows | `(T - L) × L × F` | Consecutive observations for each sample |
| Targets | `T - L` | CO2 value immediately after each window |

The number of samples is `N = T - L` because each window requires a following observation as its label. For example, a window containing timesteps 0 through `L - 1` is paired with the target at timestep `L`.

## Mapping the window copy onto CUDA threads

The main kernel assigns one thread to each output element. A flat global thread index is decoded into a sample, a position inside the window, and a feature. Each thread then performs one global-memory read and one write.

```text
KERNEL BUILD_WINDOWS(input, windows, N, L, F)
    tid ← blockIdx.x × blockDim.x + threadIdx.x
    IF tid ≥ N × L × F: RETURN

    feature ← tid MOD F
    offset  ← FLOOR(tid / F) MOD L
    sample  ← FLOOR(tid / (L × F))

    source ← (sample + offset) × F + feature
    windows[tid] ← input[source]
END KERNEL
```

Features occupy the fastest-varying dimension in contiguous row-major memory. Adjacent threads therefore write adjacent output locations and generally read adjacent feature values, which favors coalesced memory access. Reads jump back when the next overlapping window begins, so the entire source access sequence is not globally contiguous.

Each output location has exactly one writer. This mapping needs neither atomics nor communication between threads. It still performs `N × L × F` element copies: parallelization changes how the work executes, while the materialized output and its memory cost remain.

## Aligning the prediction targets

A separate one-dimensional kernel assigns one thread per sample. Keeping target extraction separate makes the label offset explicit and avoids writing the same target once for every feature and window position.

```text
KERNEL BUILD_TARGETS(target_column, labels, N, L)
    sample ← blockIdx.x × blockDim.x + threadIdx.x
    IF sample ≥ N: RETURN

    labels[sample] ← target_column[sample + L]
END KERNEL
```

The offset is essential: copying the target from the start of a window would change the learning task. The CUDA path must preserve the reference implementation's sequence ordering and next-timestep labels.

## Launch geometry and host integration

The launcher uses 256 threads per block and rounds each grid size upward. Bounds checks inside the kernels handle extra threads in the final block.

```text
HOST CREATE_SEQUENCES(input, target_column, T, F, L)
    REQUIRE contiguous float32 tensors on CUDA
    N ← T - L
    REQUIRE N > 0

    ALLOCATE windows[N × L × F] on device
    ALLOCATE labels[N] on device

    threads ← 256
    window_blocks ← CEIL_DIV(N × L × F, threads)
    target_blocks ← CEIL_DIV(N, threads)

    LAUNCH BUILD_WINDOWS<<<window_blocks, threads>>>(...)
    CHECK launch error
    LAUNCH BUILD_TARGETS<<<target_blocks, threads>>>(...)
    CHECK launch error
    SYNCHRONIZE device and check execution error

    RETURN windows, labels
END HOST
```

The C++ binding validates CUDA placement, float32 type, contiguity, and that at least one sequence can be formed. The extension build compiles the CUDA and C++ sources into a PyTorch-callable module using C++17. The surrounding interface also checks for non-finite input values and provides a CPU reference fallback when the extension or CUDA is unavailable.

The current compatibility path transfers the generated tensors back to CPU memory before the rest of the training pipeline consumes them. That makes data movement an important part of any end-to-end performance assessment.

## An additional normalization kernel

The CUDA source also implements elementwise min–max normalization using supplied per-feature minima and maxima. A small-range guard maps constant or nearly constant features to zero.

```text
KERNEL NORMALIZE(values, feature_min, feature_max, total, F)
    tid ← blockIdx.x × blockDim.x + threadIdx.x
    IF tid ≥ total: RETURN

    feature ← tid MOD F
    low ← feature_min[feature]
    range ← feature_max[feature] - low

    IF range > 1e-8:
        values[tid] ← (values[tid] - low) / range
    ELSE:
        values[tid] ← 0
END KERNEL
```

This kernel is implemented in the source but is not invoked by the current sequence-creation launcher. It does not compute the feature statistics itself. A future integrated path would need training-only statistics to avoid leaking validation or test information into preprocessing.

## Verification and performance status

The interface includes an optional benchmark mode that compares the CUDA outputs with a CPU reference using an absolute tolerance of `1e-5`, and prints timings and a speedup ratio. Output mismatches currently produce warnings rather than failing assertions.

The CUDA timing covers the extension call and synchronization, after the input transfer to the GPU and before copying the outputs back to the CPU. It therefore does not measure the complete preprocessing path. A useful evaluation should report both device-side execution and end-to-end latency, including transfers and allocations, with warm-up runs and repeated measurements.

The inspected repository does not contain recorded CUDA benchmark results, so no measured speedup is claimed here. The older model experiment notes describe a different evaluation question and do not establish the performance of these kernels. This documentation update did not compile or execute the CUDA extension.

## Lessons and next steps

This exercise connects tensor layout to GPU execution: flat indexing, bounds checks, contiguous memory, and exact label alignment determine whether a parallel implementation preserves the original preprocessing behavior.

The current approach materializes overlapping windows, requiring approximately `4 × N × L × F` bytes for float32 feature output alone. Large inputs can therefore become memory-bound even when the copy kernel is fast. Useful next experiments include batching window creation, keeping tensors on the GPU through training, and comparing materialized copies against a strided-window approach.

Further work would strengthen shape and device validation, turn reference comparisons into assertions, and profile realistic workloads before choosing more complex memory optimizations. The implemented kernels provide a concrete foundation for that investigation without exposing the team's original model implementations.

## Links and resources

- [CUDA exercise repository](https://github.com/swetshgit/DL2025_CUDA_Exercise)
- [Temporal feature kernels](https://github.com/swetshgit/DL2025_CUDA_Exercise/blob/main/cuda_kernels/temporal_features.cu)
