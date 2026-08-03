export const builtinFunctors = Object.freeze([
    { name: "id", domain: "*", codomain: "*", law: "category.identity" },
    { name: "compose", domain: "B -> C", codomain: "(A -> B) -> (A -> C)", law: "category.compose" },
    { name: "field", domain: "Structure", codomain: "Type", law: "structure.projection" },
    { name: "path", domain: "Context", codomain: "Value", law: "json.path" },
    { name: "witness", domain: "Proposition", codomain: "Proof", law: "curry_howard.witness" },
]);
