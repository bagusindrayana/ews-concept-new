export interface XmlAttributes {
    [key: string]: string;
}

export interface JsonNode {
    "@attributes"?: XmlAttributes;
    "#text"?: string;
    [key: string]:
        | JsonNode
        | JsonNode[]
        | string
        | XmlAttributes
        | null
        | undefined;
}

export type JsonValue = JsonNode | JsonNode[] | string | null;

export function xmlToJson(xmlString: string): Record<string, JsonValue> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
        throw new Error("Invalid XML: " + parseError.textContent);
    }

    function nodeToJson(node: Element): JsonValue {
        const obj: JsonNode = {};

        // Handle attributes
        if (node.attributes && node.attributes.length > 0) {
            obj["@attributes"] = {};
            for (const attr of Array.from(node.attributes)) {
                (obj["@attributes"] as XmlAttributes)[attr.name] = attr.value;
            }
        }

        // Handle child nodes
        for (const child of Array.from(node.childNodes)) {
            // Text node
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim();
                if (text) {
                    obj["#text"] = text;
                }
                continue;
            }

            // Element node
            if (child.nodeType === Node.ELEMENT_NODE) {
                const childElement = child as Element;
                const childJson = nodeToJson(childElement);
                const nodeName = childElement.nodeName;

                if (obj[nodeName] === undefined) {
                    obj[nodeName] = childJson;
                } else if (Array.isArray(obj[nodeName])) {
                    (obj[nodeName] as JsonNode[]).push(childJson as JsonNode);
                } else {
                    obj[nodeName] = [
                        obj[nodeName] as JsonNode,
                        childJson as JsonNode,
                    ];
                }
            }
        }

        // If only #text, return the value directly
        if (Object.keys(obj).length === 1 && obj["#text"] !== undefined) {
            return obj["#text"];
        }

        // If empty node
        if (Object.keys(obj).length === 0) {
            return null;
        }

        return obj;
    }

    const root = xmlDoc.documentElement;
    return { [root.nodeName]: nodeToJson(root) };
}
