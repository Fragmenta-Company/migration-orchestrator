use regex::Regex;
use ts_rs::TS;

use crate::parse_errors::ParseErrorKind;

const REGEX_MIGRATION: &str = r"Migration\(([^)]+)\)";
const REGEX_GROUP: &str = r"Group\(([^)]+)\)";

#[derive(TS, Debug, Clone, PartialEq, Eq, Hash)]
#[ts(export)]
pub enum Dependency {
    Migration(String),
    Group(String),
    Function(String),
    Macro(String),
    InAnotherFile(Box<Dependency>),
}

impl Dependency {
    pub fn new(dependency: impl Into<String>) -> Result<Self, ParseErrorKind> {
        let dependency = dependency.into();
        let migration_regex = Regex::new(REGEX_MIGRATION).expect("Invalid regex for migration");
        let group_regex = Regex::new(REGEX_GROUP).expect("Invalid regex for group");

        if dependency.starts_with("::") {
            return Ok(Self::InAnotherFile(Box::new(Self::new(
                dependency.trim_start_matches("::").to_string()
            )?)));
        }

        if migration_regex.captures(&dependency).is_some() {
            Ok(Self::Migration(
                dependency,
            ))
        } else if group_regex.captures(&dependency).is_some() {
            Ok(Self::Group(
                dependency,
            ))
        } else {
            Err(ParseErrorKind::InvalidDependencyFormat(dependency))
        }
    }

    pub fn new_function(complete_path: impl Into<String>) -> Self {
        Self::Function(complete_path.into())
    }

    pub fn new_macro(complete_path: impl Into<String>) -> Self {
        Self::Macro(complete_path.into())
    }

    pub fn migration(complete_path: impl Into<String>) -> Self {
        Self::Migration(complete_path.into())
    }

    pub fn group(complete_path: impl Into<String>) -> Self {
        Self::Group(complete_path.into())
    }

    pub fn complete_path(&self) -> &str {
        match self {
            Self::Migration(path) => path,
            Self::Group(path) => path,
            Self::Function(path) => path,
            Self::Macro(path) => path,
            Self::InAnotherFile(dependency) => dependency.complete_path(),
        }
    }

    pub fn name(&self) -> &str {
        match self {
            Self::Function(path) => path.split("::").last().unwrap_or(""),
            Self::Macro(path) => path.split("::").last().unwrap_or(""),
            Self::Migration(path) => path.split("::").last().unwrap_or(""),
            Self::Group(path) => path.split("::").last().unwrap_or(""),
            Self::InAnotherFile(dependency) => dependency.name(),
        }
    }

    pub fn is_migration(&self) -> bool {
        matches!(self, Self::Migration(_))
    }

    pub fn is_group(&self) -> bool {
        matches!(self, Self::Group(_))
    }

    pub fn is_from_other_file(&self) -> bool {
        matches!(self, Self::InAnotherFile(_))
    }

    pub fn is_from_current_file(&self) -> bool {
        !self.is_from_other_file()
    }
}
