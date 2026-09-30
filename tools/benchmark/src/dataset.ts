/**
 * Dataset types and loader interfaces.
 *
 * The dataset itself stays outside Git (see .gitignore). The benchmark reads
 * it from a configurable local path; only aggregate metrics are persisted.
 *
 * Real image / video decoders are deferred until an engine is selected. For
 * the POC, callers inject an ImageLoader and (optionally) VideoFrameExtractor.
 */

import type { ImageInput } from "@identa/core";

export type ImageKind = "ktp" | "selfie" | "frame";

export interface DatasetPerson {
  /** Stable identifier for the person. NEVER persisted in benchmark output. */
  readonly id: string;
  readonly images: {
    readonly ktp: string;
    readonly selfie: string;
    readonly video?: string;
  };
}

export interface Dataset {
  /** Local filesystem path or opaque source label. NEVER persisted verbatim. */
  readonly sourcePath: string;
  readonly persons: ReadonlyArray<DatasetPerson>;
}

export interface ImageLoader {
  load(path: string): Promise<ImageInput>;
}

export interface VideoFrameExtractor {
  extract(path: string): AsyncIterable<ImageInput>;
}

/**
 * Build a Dataset from an in-memory description.
 *
 * Useful for tests. Production code is expected to scan the filesystem
 * at the configured dataset path and produce an equivalent structure.
 */
export function buildDataset(
  sourcePath: string,
  persons: ReadonlyArray<DatasetPerson>,
): Dataset {
  return Object.freeze({ sourcePath, persons: Object.freeze([...persons]) });
}
