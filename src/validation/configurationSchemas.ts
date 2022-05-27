import * as yup from "yup";

export const configurationSchema = yup.object().shape({
    files: yup.array(yup.object().shape({
        source: yup.string().trim().required(),
        target: yup.string().trim().required()
    }).required()).min(1).required(),
    pretty: yup.boolean(),
    indent: yup.number().positive(),
    watch: yup.boolean()
}).noUnknown().strict();