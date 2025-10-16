// examples.js - Pre-defined examples for XMLDOT playground
// This file is loaded before the main application to provide interactive examples

const EXAMPLES = {
    basic: [
        {
            name: "Simple Element Access",
            xml: `<catalog>
  <book id="1">
    <title>The Go Programming Language</title>
    <author>Alan Donovan</author>
    <price>44.99</price>
  </book>
</catalog>`,
            path: "catalog.book.title",
            description: "Access a simple nested element"
        },
        {
            name: "Attribute Access",
            xml: `<catalog>
  <book id="bk101">
    <title>XML Developer's Guide</title>
  </book>
</catalog>`,
            path: "catalog.book.@id",
            description: "Access an attribute value using @ prefix"
        },
        {
            name: "Count Elements",
            xml: `<catalog>
  <book><title>Book 1</title></book>
  <book><title>Book 2</title></book>
  <book><title>Book 3</title></book>
</catalog>`,
            path: "catalog.book.#",
            description: "Count the number of matching elements"
        }
    ],
    arrays: [
        {
            name: "Array Index Access",
            xml: `<catalog>
  <book><title>First Book</title></book>
  <book><title>Second Book</title></book>
  <book><title>Third Book</title></book>
</catalog>`,
            path: "catalog.book.1.title",
            description: "Access array element by index (0-based)"
        },
        {
            name: "Last Element Access",
            xml: `<catalog>
  <book><title>First Book</title></book>
  <book><title>Second Book</title></book>
  <book><title>Last Book</title></book>
</catalog>`,
            path: "catalog.book.2.title",
            description: "Access last element by index (third element = index 2)"
        }
    ],
    wildcards: [
        {
            name: "Single-Level Wildcard",
            xml: `<catalog>
  <book><title>Go Programming</title><price>44.99</price></book>
  <magazine><title>Go Monthly</title><price>9.99</price></magazine>
</catalog>`,
            path: "catalog.*.title",
            description: "Match any element at one level"
        },
        {
            name: "Recursive Wildcard",
            xml: `<catalog>
  <section>
    <book><price>44.99</price></book>
  </section>
  <book><price>39.99</price></book>
</catalog>`,
            path: "catalog.**.price",
            description: "Match elements at any depth"
        }
    ],
    filters: [
        {
            name: "Filter by Comparison",
            xml: `<catalog>
  <book><title>Expensive Book</title><price>59.99</price></book>
  <book><title>Cheap Book</title><price>19.99</price></book>
  <book><title>Medium Book</title><price>39.99</price></book>
</catalog>`,
            path: "catalog.book.#(price>40)#.title",
            description: "Find all books priced over $40"
        },
        {
            name: "Filter by Equality",
            xml: `<catalog>
  <book><title>Go Programming</title><category>Programming</category></book>
  <book><title>Python Basics</title><category>Programming</category></book>
  <book><title>SQL Guide</title><category>Database</category></book>
</catalog>`,
            path: 'catalog.book.#(category==Programming)#.title',
            description: "Find books in Programming category"
        },
        {
            name: "Attribute Filter",
            xml: `<catalog>
  <book id="active"><title>Go Advanced</title><price>59.99</price></book>
  <book id="active"><title>Go Basics</title><price>29.99</price></book>
  <book id="inactive"><title>Python Guide</title><price>49.99</price></book>
</catalog>`,
            path: 'catalog.book.#(@id==active)#.title',
            description: "Filter books by attribute value"
        }
    ],
    modifiers: [
        {
            name: "Reverse Array",
            xml: `<catalog>
  <book><title>First</title></book>
  <book><title>Second</title></book>
  <book><title>Third</title></book>
</catalog>`,
            path: "catalog.book.#.title|@reverse",
            description: "Reverse the order of results"
        },
        {
            name: "Sort Results",
            xml: `<catalog>
  <book><price>44.99</price></book>
  <book><price>19.99</price></book>
  <book><price>39.99</price></book>
</catalog>`,
            path: "catalog.book.#.price|@sort",
            description: "Sort results in ascending order"
        },
        {
            name: "Get First Element",
            xml: `<catalog>
  <book><title>First Book</title></book>
  <book><title>Second Book</title></book>
  <book><title>Third Book</title></book>
</catalog>`,
            path: "catalog.book.#.title|@first",
            description: "Get the first element from results"
        },
        {
            name: "Combined Modifiers",
            xml: `<catalog>
  <book><title>Zebra Book</title></book>
  <book><title>Alpha Book</title></book>
  <book><title>Beta Book</title></book>
</catalog>`,
            path: "catalog.book.#.title|@sort|@reverse",
            description: "Chain multiple modifiers (sort then reverse)"
        }
    ],
    advanced: [
        {
            name: "Complex Query",
            xml: `<library>
  <section name="tech">
    <book><title>Go Guide</title><price>45.00</price><year>2023</year></book>
    <book><title>Python Handbook</title><price>40.00</price><year>2022</year></book>
  </section>
  <section name="fiction">
    <book><title>Novel One</title><price>20.00</price><year>2023</year></book>
  </section>
</library>`,
            path: 'library.section.#(@name=="tech").book.#(price>40).title',
            description: "Nested filters with attribute matching"
        }
    ]
};

// Helper function to get all examples as a flat array
function getAllExamples() {
    const all = [];
    for (const category in EXAMPLES) {
        EXAMPLES[category].forEach(example => {
            all.push({
                ...example,
                category: category
            });
        });
    }
    return all;
}

// Helper function to get examples by category
function getExamplesByCategory(category) {
    return EXAMPLES[category] || [];
}
