# y2jc

## YAML to JSON compiler

This library does one thing: 
It copies files from a given source to a target.
If YAML files are found, it converts them to JSON format.

After installing the library and creating a configuration file named **json.compiler.yaml**, fill in a source and destination directory pair.
With the command **npx yaml** the executable is launched and synchronizes the sources and destinations.

## Configuration
The executable needs a configuration file to work.
The configuration file must be called **json.compiler.yaml** and must be located in the root of the project (at the same level as the **node_modules** folder).
###List of the different keys of the configuration file
 ####Required keys
 - **files** (object array)
represents an array where each element will be an object with the **source** and **target** keys corresponding to the directories to synchronize.

#### Optional keys
- **watch** (boolean - **false** by default)
If the **watch** key is set to **true**, the executable will monitor every change in the source directories and reflect them to the target directories.
If the option is set to **false**, it will synchronize the directories only once before exiting the program.

- **pretty** (boolean - **false** by default)
If this option is set to **true** the compiled json file will be prettified.

- **indent** (number - **2** by default)
If this option is set, defines the number of indent spaces in the prettified json file.

### Example of a configuration file
```yaml
files: 
  - 
    source: "./configuration/src"
    target: "./configuration/json"
#-
  #source: "./another/source/directory"
  #target: "./another/target/directory"

pretty: true

indent: 2

watch: true
```


###End
