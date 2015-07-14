/**
 * Responsible for schema serialization and deserialization
 *
 * In order to add a new FieldType, you need to do the following:
 * 1. Add a new type key and toProperty (serialization) function to FieldTypes
 * 2. Add a new field definition object to the json schema (builder-schemas/related.json).
 *    Ensure your newly created object has a matching fieldType attribute, which must be unique.
 *    This is so that when we serialize this object to data and back, we can remember what
 *    type of field it is.
 *
 * @return {[type]} [description]
 */
(function () {
    'use strict';

    /* ngInject */
    function Schemas() {
        // Static properties which cannot be changed when editing a schema
        var systemOnlyProperties = { _localId: true };

        var module = {
            JsonObject: jsonObject,
            FieldTypes: {
                'text': { // Text field
                    toProperty: function(fieldData) {
                        return {
                            type: 'string',
                            format: fieldData.textOptions
                        };
                    }
                },
                'selectlist': { // Select list
                    toProperty: function(fieldData) {
                        return {
                            type: 'string',
                            enum: fieldData.fieldOptions,
                            displayType: fieldData.displayType
                        };
                    }
                },
                'image': { // Image uploader
                    toProperty: function() {
                        return {
                            type: 'string',
                            media: {
                                binaryEncoding: 'base64',
                                type: 'image/jpeg'
                            }
                        };
                    }
                },
                'reference': { // Local reference
                    toProperty: function(fieldData) {
                        // TODO: Add autodiscovery of field names so that we can more intelligently
                        // populate enumSource.title below. This will require making the rest of the
                        // schema available to the serialization function. Beware of
                        // self-referential content types; they will need to auto-discover against
                        // the new definition, rather than any definition which might already exist
                        // in the schema.
                        return {
                            type: 'string',
                            watch: {
                                target: fieldData.referenceTarget
                            },
                            enumSource: [{
                                    source: 'target',
                                    title: fieldData.referenceTarget + ' {{i}}',
                                    value: '{{item._localId}}'
                            }]
                        };
                    }
                }
            },
            addVersion4Declaration: addVersion4Declaration,
            addRelatedContentFields: addRelatedContentFields,
            validateSchemaFormData: validateSchemaFormData,
            definitionFromSchemaFormData: definitionFromSchemaFormData,
            schemaFormDataFromDefinition: schemaFormDataFromDefinition,
            encodeJSONPointer: encodeJSONPointer
        };
        return module;

        /**
         * Encode a string so that it complies with the JSON Pointer spec
         * http://tools.ietf.org/html/draft-pbryan-zyp-json-pointer-02
         * This is what is used in $ref to specify sub-schema paths
         * @param {string} str
         * @return {string} Currently just returns encodeURIComponent(string)
         */
        function encodeJSONPointer(str) {
            // TODO: This can probably be switched after upgrading json-editor:
            // https://github.com/jdorn/json-editor/issues/402
            // return encodeURIComponent(str);
            // But the current version of json-editor doesn't support this properly.
            return str;
        }

        /**
         * Converts part of the output of a Schema Entry Form (data about fields)
         * into a snippet designed to be inserted into the 'properties' key of a Data Form Schema
         * which would be used for data entry / editing. Does not perform validation.
         * @param {object} fieldData The value of one Schema Entry Form field, specifying required,
         *      searchable, possible values, etc.
         * @param {number} index The index of this field in its form
         * @return {object} A snippet designed to be inserted into the 'properties' of a Data Form
         *      Schema
         */
        // TODO: This monolithic function isn't great; investigate more modular options
        // (likewise in the deserializing function below)
        function _propertyFromSchemaFieldData(fieldData, index, allData) {
            var propertyDefinition = module.FieldTypes[fieldData.fieldType].toProperty(fieldData,
                    index,
                    allData
                );

            // Set the common properties
            propertyDefinition.isSearchable = fieldData.isSearchable;

            // Include the fieldType to make deserialization easier; without this we have to guess
            // based on other properties.
            propertyDefinition.fieldType = fieldData.fieldType;

            // Insert the array index into the 'propertyOrder' key; this is a custom key
            // defined by JSON-Editor to allow specification of property ordering, which is not
            // supported by JSON-Schema (yet)
            propertyDefinition.propertyOrder = index;

            return propertyDefinition;
        }

        /**
         * Converts the output of a Schema Entry Form into a sub-schema designed to be
         * inserted into the 'definitions' key of a Data Form Schema. Does not perform
         * validation.
         * @param {array} formData The values in the Schema Form, defining the fields in
         *      this Data Form Schema
         * @return {object} The serialized JSON-Schema snippet
         */
        function definitionFromSchemaFormData(formData) {
            var definition = {
                properties: {},
                type: 'object'
            };
            definition = addRelatedContentFields(definition);
            // properties
            _.each(formData, function(fieldData, index, allData) {
                definition.properties[fieldData.fieldTitle] = _propertyFromSchemaFieldData(
                    fieldData,
                    index,
                    allData
                );
            });

            // required
            // A list containing the titles of properties which are required.
            var required = _.pluck(
                _.filter(formData, function(fieldData) {
                    return fieldData.isRequired;
                }), 'fieldTitle');

            // All definitions start with a required "_localId" property
            definition.required = definition.required.concat(required);

            return definition;
        }

        /**
         * Inverse of the above; converts a sub-schema into a JSON-Schema that will allow
         * JSON-Editor to generate the correct form elements for editing the fields in the schema.
         * @param {object} definition The sub-schema to convert into fields
         * @return {array} Form schema to allow editing the fields in definition
         */
        function schemaFormDataFromDefinition(definition) {
            var formData = [];
            _.each(definition.properties, function(schemaField, title) {
                if (systemOnlyProperties[title]) {
                    // Don't include in schema editor form
                } else {
                    var fieldData = {
                        fieldTitle: title
                    };
                    // Iterate over schema keys and take the appropriate action
                    _.each(schemaField, function(value, key) {
                        switch(key) {
                            case 'enum':
                                fieldData.fieldOptions = value;
                                break;
                            case 'format':
                                fieldData.textOptions = value;
                                break;
                            case 'type': // This is the JSON-Schema 'type', which is not used here.
                                break;
                            case 'media': // Also not used
                                break;
                            case 'watch':
                                fieldData.referenceTarget = value.target;
                                break;
                            case 'enumSource': // Companion to 'watch', but not used here
                                break;
                            default:
                                fieldData[key] = value;
                        }
                    });

                    // Handle required fields, which are stored outside the field info
                    var indexInRequired = _.findIndex(definition.required, function(item) {
                        return item === title;
                    });
                    if (indexInRequired >= 0) { // I.e., found title in required: [...]
                        fieldData.isRequired = true;
                    } else {
                        fieldData.isRequired = false;
                    }

                    formData.push(fieldData);
                }
            });
            // Order the resulting array by the propertyOrder field so that fields appear in
            // the same order in which they'll appear during data entry. JSON-Editor only applies
            // the propertyOrder keyword if it appears *inside* a property. If it appears *as* a
            // property, it won't have any effect, so we need to do the sorting ourselves.
            formData.sort(function(a, b) {
                if (a.propertyOrder < b.propertyOrder) {
                    return -1;
                }
                if (a.propertyOrder > b.propertyOrder) {
                    return 1;
                }
                return 0;
            });
            return formData;
        }

        /**
         * Validate that a Schema Entry Form has valid data; currently validates that there are
         * no duplicate fieldTitles because this is currently not easily done in native
         * JSON-Schema (the uniqueItems keyword doesn't allow specifying which fields should
         * be used to determine uniqueness).
         * @param {object} formData The values in a Schema Form
         * @return {array} List of errors, if any
         *
         * TODO: JSON-Editor supports custom validators which are applied recursively from the root
         * -- these should probably be used instead of this function.
         */
        function validateSchemaFormData(formData) {
            var errors = [];
            var titleCounts = _.countBy(formData, function(fieldData) {
                return fieldData.fieldTitle;
            });
            _.forEach(titleCounts, function(count, title) {
                if (count > 1) {
                    errors.push({ 'message': 'Invalid schema: The field title "' + title +
                        '" is used more than once.'
                    });
                }
            });
            return errors;
        }

        /**
         * Adds a $schema keyword to an object; this declares that the object is JSON-Schema v4
         * @param {object} schema Object to which the declaration should be added
         * @return {object} The schema with the $schema keyword added, pointing to Draft 4
         */
        function addVersion4Declaration(schema) {
            return angular.extend(schema, { $schema: 'http://json-schema.org/draft-04/schema#' });
        }

        /**
         * Adds a _localId field to a schema's properties that can store a UUID
         * @param {object} schema Object to which the declaration should be added
         * @return {object} The schema with a _localId property added
         */
        function addRelatedContentFields(schema) {
            schema.properties = angular.extend(schema.properties, {
                _localId: { // A special field allowing relationships between objects within a record
                    // A pattern for a UUID field is helpfully supplied at
                    // http://json-schema.org/example2.html
                    type: 'string',
                    pattern: '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
                    options: {
                        hidden: true
                    }
                }
            });
            if (schema.required) {
                schema.required = schema.required.concat(['_localId']);
            } else {
                schema.required = ['_localId'];
            }
            return schema;
        }

        /**
         * Creates a new blank object for use in a JSON-Schema
         * @param {object} Object to extend; default {}
         * @return {object} A blank object for use in a JSON-Schema
         */
        function jsonObject(newObject) {
            newObject = newObject || {};
            return angular.extend({}, {
                /* jshint camelcase: false */
                type: 'object',
                title: '',
                plural_title: '',
                description: '',
                properties: {},
                definitions: {}
                /* jshint camelcase: true */
            }, newObject);
        }


    }

    angular.module('ase.schemas')
    .service('Schemas', Schemas);

})();
