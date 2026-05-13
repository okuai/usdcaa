import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = path.join(rootDir, "contracts");
const artifactsDir = path.join(rootDir, "artifacts");

function collectSolidityFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSolidityFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".sol")) {
      files.push(fullPath);
    }
  }

  return files;
}

function readSourceFiles() {
  const sources = {};

  for (const filePath of collectSolidityFiles(contractsDir)) {
    const sourceName = path.relative(rootDir, filePath).replaceAll(path.sep, "/");
    sources[sourceName] = {
      content: fs.readFileSync(filePath, "utf8")
    };
  }

  return sources;
}

function findImports(importPath) {
  const candidates = [
    path.join(rootDir, "node_modules", importPath),
    path.join(rootDir, importPath),
    path.join(contractsDir, importPath)
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, "utf8") };
    }
  }

  return { error: `File not found: ${importPath}` };
}

export function compile() {
  const input = {
    language: "Solidity",
    sources: readSourceFiles(),
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = output.errors ?? [];
  const fatalErrors = errors.filter((error) => error.severity === "error");

  for (const error of errors) {
    const stream = error.severity === "error" ? process.stderr : process.stdout;
    stream.write(`${error.formattedMessage}\n`);
  }

  if (fatalErrors.length > 0) {
    throw new Error("Solidity compilation failed");
  }

  fs.rmSync(artifactsDir, { recursive: true, force: true });

  const artifacts = {};

  for (const [sourceName, contracts] of Object.entries(output.contracts)) {
    for (const [contractName, contractOutput] of Object.entries(contracts)) {
      const artifact = {
        contractName,
        sourceName,
        abi: contractOutput.abi,
        bytecode: contractOutput.evm.bytecode.object,
        deployedBytecode: contractOutput.evm.deployedBytecode.object
      };

      const artifactPath = path.join(artifactsDir, sourceName, `${contractName}.json`);
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

      artifacts[`${sourceName}:${contractName}`] = artifact;
    }
  }

  return artifacts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifacts = compile();
  const contractNames = Object.keys(artifacts).sort();
  console.log(`Compiled ${contractNames.length} contracts`);
  for (const name of contractNames) {
    console.log(`- ${name}`);
  }
}
