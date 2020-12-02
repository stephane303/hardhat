import type { DecoderOptions } from "cbor";
import debug from "debug";
import { NomicLabsHardhatPluginError } from "hardhat/plugins";
import util from "util";

import { pluginName } from "../pluginContext";

const log = debug("hardhat-etherscan:metadata-decoder");

export const METADATA_LENGTH_SIZE = 2;

// Instances of these errors are not supposed to be seen by the task.
export class VersionNotFoundError extends NomicLabsHardhatPluginError {
  constructor(message: string) {
    super(pluginName, message, undefined, true);
    Object.setPrototypeOf(this, VersionNotFoundError.prototype);
  }
}

export class MetadataAbsentError extends NomicLabsHardhatPluginError {
  constructor(message: string) {
    super(pluginName, message, undefined, true);
    Object.setPrototypeOf(this, MetadataAbsentError.prototype);
  }
}

export async function readSolcVersion(bytecode: Buffer): Promise<string> {
  let solcMetadata;
  try {
    const metadata = await decodeSolcMetadata(bytecode);
    log(`Metadata decoded: ${util.inspect(metadata)}`);
    solcMetadata = metadata.solc;
  } catch (error) {
    throw new MetadataAbsentError("Could not decode metadata.");
  }
  if (solcMetadata instanceof Buffer) {
    const [major, minor, patch] = solcMetadata;
    return `${major}.${minor}.${patch}`;
  }
  throw new VersionNotFoundError("Could not find solc version in metadata.");
}

export async function decodeSolcMetadata(bytecode: Buffer) {
  const metadataLength = readSolcMetadataLength(bytecode);
  // The metadata and its length are in the last few bytes.
  const metadataPayload = bytecode.slice(
    -metadataLength - METADATA_LENGTH_SIZE,
    -METADATA_LENGTH_SIZE
  );

  log(`Read metadata length ${metadataLength}`);

  const lastMetadataBytes = metadataPayload.slice(-100);
  log(
    `Last ${
      lastMetadataBytes.length
    } bytes of metadata: ${lastMetadataBytes.toString("hex")}`
  );

  const { decodeFirst } = await import("cbor");
  // The documentation for decodeFirst mentions the `required` option even though
  // the type information is missing it.
  // See http://hildjj.github.io/node-cbor/Decoder.html#.decodeFirst
  const options: DecoderOptions = { required: true } as any;
  return decodeFirst(metadataPayload, options);
}

export function readSolcMetadataLength(bytecode: Buffer) {
  return bytecode.slice(-METADATA_LENGTH_SIZE).readUInt16BE(0);
}
