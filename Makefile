.PHONY: all build serve clean deploy verify check-prereqs test test-security test-phase2

# Go WASM runtime location
GOROOT=$(shell go env GOROOT)
WASM_EXEC=$(shell find "$(GOROOT)" -name "wasm_exec.js" 2>/dev/null | head -n 1)

all: build

# Check prerequisites before building
check-prereqs:
	@echo "Checking prerequisites..."
	@command -v go >/dev/null 2>&1 || { echo "Error: Go is not installed"; exit 1; }
	@go version | grep -E "go1\.(2[4-9]|[3-9][0-9]|[1-9][0-9]{2,})" >/dev/null 2>&1 || { echo "Error: Go 1.24 or later required"; exit 1; }
	@command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || { echo "Error: Python is not installed (required for 'make serve')"; exit 1; }
	@test -n "$(WASM_EXEC)" || { echo "Error: wasm_exec.js not found in GOROOT"; exit 1; }
	@echo "Prerequisites OK: Go $$(go version | awk '{print $$3}')"

# Build WASM binary
build: check-prereqs
	@echo "Building WASM module..."
	GOOS=js GOARCH=wasm go build -ldflags="-s -w" -trimpath -o xmldot.wasm cmd/wasm/main.go
	@echo "Copying Go WASM runtime..."
	@if [ -z "$(WASM_EXEC)" ]; then \
		echo "Error: wasm_exec.js not found in GOROOT"; \
		exit 1; \
	fi
	cp "$(WASM_EXEC)" .
	@echo "Generating SRI hash for wasm_exec.js..."
	@set -euo pipefail; \
	hash=$$(openssl dgst -sha384 -binary wasm_exec.js | openssl base64 -A) || { \
		echo "ERROR: Failed to generate SRI hash"; exit 1; \
	}; \
	[ -n "$$hash" ] || { echo "ERROR: Empty SRI hash"; exit 1; }; \
	echo "sha384-$$hash" > wasm_exec.js.sri; \
	echo "  SRI: sha384-$$hash"
	@echo "Updating index.html with SRI hash..."
	@set -euo pipefail; \
	SRI_HASH=$$(cat wasm_exec.js.sri) || { \
		echo "ERROR: Failed to read SRI hash file"; exit 1; \
	}; \
	if [[ "$$OSTYPE" == "darwin"* ]]; then \
		sed -i '' 's|<script src="wasm_exec.js"[^>]*></script>|<script src="wasm_exec.js" integrity="'"$$SRI_HASH"'" crossorigin="anonymous"></script>|g' index.html || { \
			echo "ERROR: Failed to update HTML with SRI (macOS)"; exit 1; \
		}; \
	else \
		sed -i 's|<script src="wasm_exec.js"[^>]*></script>|<script src="wasm_exec.js" integrity="'"$$SRI_HASH"'" crossorigin="anonymous"></script>|g' index.html || { \
			echo "ERROR: Failed to update HTML with SRI (Linux)"; exit 1; \
		}; \
	fi; \
	grep -q "integrity=\"sha384-" index.html || { \
		echo "ERROR: SRI hash not found in HTML after update"; exit 1; \
	}
	@echo "✓ Build complete with SRI verification"
	@ls -lh xmldot.wasm wasm_exec.js

# Build and start local server
serve: build
	@echo "Starting server at http://localhost:8000"
	@echo "Press Ctrl+C to stop"
	@python3 -m http.server 8000 2>/dev/null || python -m SimpleHTTPServer 8000

# Run all tests
test: build
	@echo "Running smoke tests..."
	@bash test/smoke-test.sh
	@echo ""
	@echo "✅ All test suites passed!"

# Verify build artifacts
verify:
	@echo "Verifying build artifacts..."
	@test -f xmldot.wasm || { echo "Error: xmldot.wasm not found"; exit 1; }
	@test -f wasm_exec.js || { echo "Error: wasm_exec.js not found"; exit 1; }
	@test -f index.html || { echo "Error: index.html not found"; exit 1; }
	@test -f style.css || { echo "Error: style.css not found"; exit 1; }
	@test -f app.js || { echo "Error: app.js not found"; exit 1; }
	@test -f examples.js || { echo "Error: examples.js not found"; exit 1; }
	@echo ""
	@echo "Verifying SRI hashes in index.html..."
	@grep -q 'integrity="sha384-' index.html || { echo "Error: No SRI hashes found in index.html"; exit 1; }
	@echo "  ✓ style.css SRI hash present"
	@grep -q 'app.js.*integrity="sha384-' index.html && echo "  ✓ app.js SRI hash present" || { echo "Error: app.js SRI hash missing"; exit 1; }
	@grep -q 'examples.js.*integrity="sha384-' index.html && echo "  ✓ examples.js SRI hash present" || { echo "Error: examples.js SRI hash missing"; exit 1; }
	@grep -q 'wasm_exec.js.*integrity="sha384-' index.html && echo "  ✓ wasm_exec.js SRI hash present" || { echo "Error: wasm_exec.js SRI hash missing"; exit 1; }
	@echo ""
	@echo "Verifying CSP headers..."
	@grep -q "script-src 'self' 'wasm-unsafe-eval'" index.html && echo "  ✓ CSP script-src configured correctly" || { echo "Error: CSP script-src not configured"; exit 1; }
	@! grep -q "unsafe-inline" index.html && echo "  ✓ No 'unsafe-inline' in CSP" || { echo "Error: 'unsafe-inline' found in CSP"; exit 1; }
	@echo ""
	@echo "File sizes:"
	@echo "  - xmldot.wasm: $$(du -h xmldot.wasm | cut -f1)"
	@echo "  - wasm_exec.js: $$(du -h wasm_exec.js | cut -f1)"
	@echo "  - index.html: $$(du -h index.html | cut -f1)"
	@echo "  - style.css: $$(du -h style.css | cut -f1)"
	@echo "  - app.js: $$(du -h app.js | cut -f1)"
	@echo "  - examples.js: $$(du -h examples.js | cut -f1)"
	@echo ""
	@echo "✅ All build artifacts verified successfully!"

# Clean generated files
clean:
	@echo "Cleaning build artifacts..."
	rm -f xmldot.wasm wasm_exec.js *.sri *.sha256 index.html.bak
	@echo "Clean complete"

# Show deployment instructions
deploy: build
	@echo "Deployment handled by GitHub Actions"
	@echo "Push to main branch to trigger deployment"
