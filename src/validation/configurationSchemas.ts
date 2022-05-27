import * as yup from "yup";

export const configurationSchema = yup.object().shape({
    inputs: yup.array(yup.string().trim().required()).required(),
    outputs: yup.array(yup.string().trim().required()).required(),
    pretty: yup.boolean(),
    indent: yup.number().positive(),
    files: yup.array(yup.object().shape({
        input: yup.string().trim().required(),
        output: yup.string().trim().required()
    }).required()),
    blacklist: yup.array(yup.string().trim().required())
}).noUnknown().strict();