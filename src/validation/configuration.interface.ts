export interface configurationOptions {
    pretty: boolean,
    indent: number,
    watch: boolean
}

export type configurationFiles = { source: string, target: string }

export interface configurationInterface extends configurationOptions {
    files: configurationFiles[]
}