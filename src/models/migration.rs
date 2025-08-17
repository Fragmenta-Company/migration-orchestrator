use std::collections::HashSet;
use ts_rs::TS;

use crate::{
    models::{migration_dependency::Dependency, migration_tags::MigrationTags},
    parse_errors::ParseErrorKind,
};

#[derive(TS, Debug, Clone, Default)]
#[ts(export)]
pub struct Migration {
    name: String,
    full_path: Option<String>,
    version: Option<String>,
    description: String,
    sql: String,
    sql_rollback: String,
    dependencies: Vec<Dependency>,
    tags: HashSet<MigrationTags>,
    nuclear: bool,
}

impl Migration {
    pub fn new(name: impl Into<String>) -> Self {
        Migration {
            name: name.into(),
            ..Default::default()
        }
    }

    pub fn add_tag(&mut self, unparsed_tag: impl Into<String>) -> Result<bool, ParseErrorKind> {
        let tag = MigrationTags::try_from(unparsed_tag.into())?;
        Ok(self.tags.insert(tag))
    }

    pub fn add_description(&mut self, description: impl Into<String>) {
        if self.description.is_empty() {
            self.description = description.into();
        } else {
            self.description
                .push_str(&format!("\n{}", description.into()));
        }
    }

    pub fn add_sql(&mut self, sql: impl Into<String>) {
        if self.sql.is_empty() {
            self.sql = sql.into();
        } else {
            self.sql.push_str(&format!("\n{}", sql.into()));
        }
    }

    pub fn add_sql_rollback(&mut self, sql: impl Into<String>) {
        if self.sql_rollback.is_empty() {
            self.sql_rollback = sql.into();
        } else {
            self.sql_rollback.push_str(&format!("\n{}", sql.into()));
        }
    }

    pub fn add_dependency(&mut self, dependency: Dependency) {
        self.dependencies.push(dependency);
    }

    pub fn set_version(&mut self, version: impl Into<String>) {
        self.version = Some(version.into());
    }

    pub fn set_full_path(&mut self, full_path: impl Into<String>) {
        self.full_path = Some(full_path.into());
    }

    pub fn set_nuclear_true(&mut self) {
        self.nuclear = true;
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn version(&self) -> Option<&str> {
        self.version.as_deref()
    }

    pub fn description(&self) -> &str {
        &self.description
    }

    pub fn sql(&self) -> &str {
        &self.sql
    }

    pub fn dependencies(&self) -> &[Dependency] {
        &self.dependencies
    }

    pub fn tags(&self) -> &HashSet<MigrationTags> {
        &self.tags
    }

    pub fn path(&self) -> &str {
        self.full_path.as_deref().unwrap_or_else(|| &self.name)
    }
}
