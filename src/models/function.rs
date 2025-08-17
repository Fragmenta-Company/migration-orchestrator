use std::collections::HashSet;

use ts_rs::TS;

use crate::{models::migration_dependency::Dependency, parse_errors::ParseErrorKind};

#[derive(TS, Debug, Clone, PartialEq, Hash, Eq)]
#[ts(export)]
pub enum FunctionTags {
    NoBoilerplate,
}

impl TryFrom<String> for FunctionTags {
    type Error = ParseErrorKind;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "noboilerplate" => Ok(FunctionTags::NoBoilerplate),
            _ => Err(ParseErrorKind::UnknownTag(value)),
        }
    }
}

#[derive(TS, Debug, Clone)]
#[ts(export)]
pub struct FuncArgument {
    pub name: String,
    pub type_name: String,
}

impl FuncArgument {
    pub fn new(name: String, type_name: String) -> Self {
        Self { name, type_name }
    }
}

#[derive(TS, Debug, Clone, Default)]
#[ts(export)]
pub struct Function {
    name: String,
    arguments: Vec<FuncArgument>,
    return_type: Option<String>,
    tags: HashSet<FunctionTags>,
    description: String,
    body: String,
    parsed_body: String,
    language: Option<String>,
    complete: bool,
    dependencies: Vec<Dependency>,
}

impl Function {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn parsed_body(&self) -> &str {
        &self.parsed_body
    }

    pub fn is_complete(&self) -> bool {
        self.complete
    }

    pub fn arguments(&self) -> &Vec<FuncArgument> {
        &self.arguments
    }

    pub fn return_type(&self) -> String {
        self.return_type.clone().unwrap_or("VOID".to_string())
    }

    pub fn description(&self) -> &str {
        &self.description
    }

    pub fn body(&self) -> &str {
        &self.body
    }

    pub fn language(&self) -> String {
        self.language.clone().unwrap_or("plpgsql".to_string())
    }

    pub fn tags(&self) -> &HashSet<FunctionTags> {
        &self.tags
    }

    pub fn dependencies(&self) -> &[Dependency] {
        &self.dependencies
    }

    pub fn add_dependency(&mut self, dependency: Dependency) {
        self.dependencies.push(dependency);
    }

    pub fn add_tag(&mut self, tag: impl Into<String>) -> Result<bool, ParseErrorKind> {
        if self.complete {
            panic!("Cannot add tags to a complete function. Use put_boilerplate() instead.");
        }
        let tag = FunctionTags::try_from(tag.into())?;
        Ok(self.tags.insert(tag))
    }

    pub fn parse_arguments(&mut self, args: impl Into<String>) -> Result<(), ParseErrorKind> {
        if self.complete {
            panic!("Cannot parse arguments on a complete function. Use put_boilerplate() instead.");
        }

        let args = args.into();
        let arguments: Vec<&str> = args.split(',').map(|s| s.trim()).collect();
        for arg in arguments {
            let parts: Vec<&str> = arg.split(':').map(|s| s.trim()).collect();
            if parts.len() == 2 {
                let name = parts[0].to_string();
                let type_name = parts[1].to_string();
                self.arguments.push(FuncArgument::new(name, type_name));
            } else {
                return Err(ParseErrorKind::MissingArgumentType);
            }
        }
        Ok(())
    }

    pub fn set_return_type(&mut self, return_type: String) {
        if self.complete {
            panic!("Cannot set return type on a complete function. Use put_boilerplate() instead.");
        }

        self.return_type = Some(return_type);
    }

    pub fn add_description(&mut self, description: impl Into<String>) {
        if self.complete {
            panic!("Cannot add description to a complete function. Use put_boilerplate() instead.");
        }

        let description = description.into();
        if self.description.is_empty() {
            self.description = description;
        } else {
            self.description.push_str(&format!("\n{description}"));
        }
    }

    pub fn add_body(&mut self, body: impl Into<String>) {
        if self.complete {
            panic!("Cannot add body to a complete function. Use put_boilerplate() instead.");
        }

        if self.body.is_empty() {
            self.body = body.into();
        } else {
            self.body.push_str(&format!("\n{}", body.into()));
        }
    }

    pub fn set_language(&mut self, language: String) {
        if self.complete {
            panic!("Cannot set language on a complete function. Use put_boilerplate() instead.");
        }

        self.language = Some(language);
    }

    pub fn put_boilerplate(&mut self) {
        if !self.tags.contains(&FunctionTags::NoBoilerplate) || self.complete {
            // remove empty lines from body
            self.parsed_body = self
                .body
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| line.trim())
                .collect::<Vec<&str>>()
                .join("\n");

            let language = &self.language.as_ref();
            let return_type = &self.return_type.as_ref();
            self.parsed_body = format!(
                "CREATE OR REPLACE FUNCTION {}({}) RETURNS {} AS $$\n{}\n$$ LANGUAGE {};",
                self.name,
                self.arguments
                    .iter()
                    .map(|arg| format!("{} {}", arg.name, arg.type_name))
                    .collect::<Vec<String>>()
                    .join(", "),
                return_type.unwrap_or(&"VOID".to_string()),
                self.parsed_body,
                language.unwrap_or(&"plpgsql".to_string())
            );
        } else if !self.complete {
            self.complete = true;
        }
    }
}
