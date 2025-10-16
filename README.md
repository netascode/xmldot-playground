# XMLDOT Playground

An interactive browser-based playground for experimenting with [XMLDOT](https://github.com/netascode/xmldot) XML queries using WebAssembly.

## Live Playground

**[Try it now!](https://netascode.github.io/xmldot-playground/)**

## About

XMLDOT Playground allows you to experiment with XML queries directly in your browser without any installation. It compiles the XMLDOT Go library to WebAssembly, enabling real-time query execution with instant results.

### Features

- **Real-time Query Execution**: Type XML and queries, see results instantly
- **Security Controls**: Resource limits prevent DoS attacks (10MB XML, 4KB queries)
- **Strict Content Security Policy**: No unsafe-inline, SRI hashes for all resources
- **Optimized WASM**: ~845 KB compressed download (2.9MB raw, optimized with -ldflags="-s -w")
- **Comprehensive Error Handling**: Graceful error messages for invalid input
- **No Installation Required**: Runs entirely in your browser
- **Interactive Examples**: Built-in example XML documents and query history
- **Dark Theme**: Easy on the eyes for extended use

## What is XMLDOT?

XMLDOT is a high-performance Go library for querying XML documents using a simple dot-notation path syntax. It provides a fast and intuitive way to extract data from XML documents.

**Example**:
```go
xml := `<catalog><book id="1"><title>XML Guide</title></book></catalog>`
title := xmldot.Get(xml, "catalog.book.title").String()
// Result: "XML Guide"
```

Learn more at the [XMLDOT repository](https://github.com/netascode/xmldot).

## Local Development

### Prerequisites

- **Go 1.24 or later** (required for building WASM)
- **Python 3.6+ or Python 2.7** (required for local server)
- **Modern web browser** with WebAssembly support (Chrome, Firefox, Safari, Edge)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/netascode/xmldot-playground.git
cd xmldot-playground

# Build and start local server
make serve

# Open browser to http://localhost:8000
```

### Building

```bash
# Build WASM binary and copy runtime
make build
```

### Makefile Commands

- `make build` - Compile WASM binary and copy Go WASM runtime
- `make serve` - Build and start local HTTP server at http://localhost:8000
- `make verify` - Verify all build artifacts exist with size report
- `make clean` - Remove generated files (xmldot.wasm, wasm_exec.js)
- `make check-prereqs` - Validate prerequisites are installed
- `make deploy` - Show deployment instructions

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Related Projects

- [XMLDOT](https://github.com/netascode/xmldot) - The XML query library powering this playground
- [gjson-play](https://github.com/tidwall/gjson-play) - Inspiration for this project (JSON query playground)

---

Built with Go and WebAssembly
