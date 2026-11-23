// Entry module of `@ngne/editor-ui/licences/build` (SPEC §4, §11).

export {
    ALLOWED_LICENCES,
    LICENCES_FILE,
    LICENCE_PHRASES,
    LicenceError,
    PACKAGE_STAND_IN_TEXTS,
    VIRTUAL_MODULES,
    buildLicencesFile,
    buildPackageDirs,
    bundlerPackagesOf,
    excludedCodeIn,
    fallbackFileOf,
    licenceAllowed,
    licenceTextMatches,
    licencesFileMismatch,
    licencesText,
    listedPackages,
    moduleSource,
    packageDirOf,
    packageDirsOf,
    readPackageLicence,
    runtimePackageDirs,
    strayPackages,
    unknownModules,
    unlistedPackages,
} from "./licences.js";
export type {
    ExcludedCode,
    LicenceText,
    LicencesInput,
    LicencesMismatch,
    LicencesOptions,
    ModuleSource,
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
    LicencesServiceWorkerPlugin,
    LicencesWorkerPlugin,
    WriteOptions,
} from "./plugin.js";
