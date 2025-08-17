use std::collections::HashSet;

use ts_rs::TS;

use crate::{
    models::{
        migration::Migration, migration_dependency::Dependency, migration_tags::MigrationTags,
    },
    parse_errors::ParseErrorKind,
};

#[derive(TS, Debug, Clone, Default)]
#[ts(export)]
pub struct MigrationGroup {
    name: String,
    version: Option<String>,
    description: String,
    migrations: Vec<Migration>,
    groups: Vec<MigrationGroup>,
    dependencies: Vec<Dependency>,
    current_group_index: usize,
    tags: HashSet<MigrationTags>,
    nuclear: bool,
}

impl Iterator for MigrationGroup {
    type Item = Migration;

    fn next(&mut self) -> Option<Self::Item> {
        // Drain local migrations first
        if let Some(m) = self.migrations.pop() {
            return Some(m);
        }

        // Then move through subgroups
        while self.current_group_index < self.groups.len() {
            if let Some(m) = self.groups[self.current_group_index].next() {
                return Some(m);
            }
            self.current_group_index += 1;
        }

        None
    }

    fn count(self) -> usize
    where
        Self: Sized,
    {
        let local_count = self.migrations.len();
        let subgroup_count: usize = self.groups.iter().map(|g| g.clone().count()).sum();

        local_count + subgroup_count
    }
}

impl MigrationGroup {
    pub fn new(name: impl Into<String>) -> Self {
        MigrationGroup {
            name: name.into(),
            ..Default::default()
        }
    }

    pub fn add_tag(&mut self, unparsed_tag: impl Into<String>) -> Result<bool, ParseErrorKind> {
        Ok(self
            .tags
            .insert(MigrationTags::try_from(unparsed_tag.into())?))
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

    pub fn migrations(&self) -> &[Migration] {
        &self.migrations
    }

    pub fn groups(&self) -> &[MigrationGroup] {
        &self.groups
    }

    pub fn dependencies(&self) -> &[Dependency] {
        &self.dependencies
    }

    pub fn set_version(&mut self, version: impl Into<String>) {
        self.version = Some(version.into());
    }

    pub fn add_description(&mut self, description: impl Into<String>) {
        if self.description.is_empty() {
            self.description = description.into();
        } else {
            self.description
                .push_str(&format!("\n{}", description.into()));
        }
    }

    pub fn add_migration(&mut self, migration: Migration) {
        self.migrations.push(migration);
    }

    pub fn add_group(&mut self, group: MigrationGroup) {
        self.groups.push(group);
    }

    pub fn add_dependency(&mut self, dependency: Dependency) {
        self.dependencies.push(dependency);
    }

    pub fn set_nuclear_true(&mut self) {
        self.nuclear = true;
    }

    pub fn tags(&self) -> &HashSet<MigrationTags> {
        &self.tags
    }
}
