// Entry module of `@ngne/editor-ui/licences/build` (SPEC §4, §11).

export {
    ALLOWED_LICENCES,
    LICENCES_FILE,
    LicenceError,
    PACKAGE_STAND_IN_TEXTS,
    buildLicencesFile,
    buildPackageDirs,
    excludedCodeIn,
    fallbackFileOf,
    licenceAllowed,
    licencesText,
    packageDirOf,
    packageDirsOf,
    readPackageLicence,
    runtimePackageDirs,
    strayPackages,
} from "./licences.js";
export type {
    ExcludedCode,
    LicenceText,
    LicencesInput,
    LicencesOptions,
    PackageLicence,
    StandInTexts,
} from "./licences.js";
export { generateLicences } from "./plugin.js";
export type {
    BundleContext,
    BundleOutput,
    DevServer,
    LicencesPlugin,
    LicencesPlugins,
    LicencesWorkerPlugin,
} from "./plugin.js";
