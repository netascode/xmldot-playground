//go:build js && wasm

package main

import (
	"fmt"
	"strings"
	"syscall/js"

	"github.com/netascode/xmldot"
)

// Resource limits (security controls)
const (
	MaxXMLSize   = 10 * 1024 * 1024 // 10MB - matches xmldot library limit
	MaxQuerySize = 4096             // 4KB - prevents query complexity DoS
	// MaxWildcardResults = 1000 (enforced internally by xmldot library)
	// MaxRecursiveOperations = 10000 (enforced internally by xmldot library)
	// Note: Timeout temporarily disabled to debug WASM issues
)

func main() {
	// Panic recovery for module initialization
	defer func() {
		if r := recover(); r != nil {
			js.Global().Get("console").Call("error",
				fmt.Sprintf("FATAL: WASM module panic during init: %v", r))
		}
	}()

	// Validate JavaScript environment
	console := js.Global().Get("console")
	if !console.Truthy() {
		panic("JavaScript console object not available")
	}

	// Bind WASM functions to JavaScript
	if err := bindWASMFunctions(); err != nil {
		console.Call("error", fmt.Sprintf("Failed to bind WASM functions: %v", err))
		return
	}

	console.Call("log", "xmldot WASM module initialized successfully")

	// Block forever to keep WASM module alive
	select {}
}

func bindWASMFunctions() error {
	global := js.Global()

	// Test property setting capability
	testKey := "__xmldot_test__"
	global.Set(testKey, js.ValueOf(true))
	if !global.Get(testKey).Bool() {
		return fmt.Errorf("cannot set properties on JavaScript global object")
	}
	global.Delete(testKey)

	// Bind functions
	global.Set("executeQuery", js.FuncOf(executeQuery))
	global.Set("validateXML", js.FuncOf(validateXML))
	global.Set("getVersion", js.FuncOf(getVersion))

	return nil
}

// executeQuery executes an XMLDOT query with resource limits and error handling.
// Args: xml (string), path (string)
// Returns: map with value, raw, exists, type, index fields OR error field
func executeQuery(this js.Value, args []js.Value) (result any) {
	// Panic recovery with safe error return
	defer func() {
		if r := recover(); r != nil {
			result = makeError("Query execution failed due to resource limits or invalid input")
		}
	}()

	// Validate argument count
	if len(args) != 2 {
		return makeError("Expected 2 arguments: xml and path")
	}

	// Validate argument types before accessing
	if args[0].Type() != js.TypeString {
		return makeError("First argument (xml) must be a string")
	}
	if args[1].Type() != js.TypeString {
		return makeError("Second argument (path) must be a string")
	}

	// Convert to Go strings first (JavaScript strings are primitives, not objects)
	// IMPORTANT: Cannot use .Get("length") on JavaScript strings - must convert first
	xml := args[0].String()
	path := args[1].String()

	// Check sizes to prevent memory allocation bombs
	xmlLen := len(xml)
	pathLen := len(path)

	if xmlLen > MaxXMLSize {
		return makeError(fmt.Sprintf("XML too large (%d bytes, max %d)", xmlLen, MaxXMLSize))
	}

	if pathLen > MaxQuerySize {
		return makeError(fmt.Sprintf("Query too large (%d bytes, max %d)", pathLen, MaxQuerySize))
	}

	// Basic validation
	path = strings.TrimSpace(path)
	if path == "" {
		return makeError("Query path cannot be empty")
	}

	// Execute XMLDOT query
	queryResult := xmldot.Get(xml, path)

	// Return structured result
	return map[string]any{
		"value":  queryResult.String(),
		"raw":    queryResult.Raw,
		"exists": queryResult.Exists(),
		"type":   typeToString(queryResult.Type),
		"index":  queryResult.Index,
	}
}

// validateXML checks if XML is well-formed using XMLDOT's validation.
// Args: xml (string)
// Returns: bool
func validateXML(this js.Value, args []js.Value) (result any) {
	// Set default return value
	result = false

	defer func() {
		if r := recover(); r != nil {
			// Panic recovered - return false for validation failure
			// Note: Don't log here as console.error can cause nested panics
			result = false
		}
	}()

	// Validate argument count
	if len(args) != 1 {
		return false
	}

	// Validate argument type
	if args[0].Type() != js.TypeString {
		return false
	}

	// Convert to Go string (JavaScript strings are primitives, not objects)
	xml := args[0].String()

	// Check size to prevent memory allocation bombs
	if len(xml) > MaxXMLSize {
		return false
	}

	return xmldot.Valid(xml)
}

// getVersion returns the XMLDOT version.
// Args: none
// Returns: string
func getVersion(this js.Value, args []js.Value) any {
	return "0.1.0"
}

// makeError creates a standardized error response.
// Only includes user-safe error messages - no stack traces or internal details.
func makeError(message string) map[string]any {
	return map[string]any{
		"error": message,
	}
}

// typeToString converts xmldot.Type to string representation.
func typeToString(t xmldot.Type) string {
	switch t {
	case xmldot.Null:
		return "Null"
	case xmldot.String:
		return "String"
	case xmldot.Number:
		return "Number"
	case xmldot.True:
		return "True"
	case xmldot.False:
		return "False"
	case xmldot.Element:
		return "Element"
	case xmldot.Attribute:
		return "Attribute"
	case xmldot.Array:
		return "Array"
	default:
		return "Unknown"
	}
}
