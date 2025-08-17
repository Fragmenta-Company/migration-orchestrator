use ts_rs::TS;

use crate::{
    models::{
        function::Function, macro_func::MacroFunc, migration::Migration,
        migration_dependency::Dependency, migration_group::MigrationGroup,
    },
    parse_errors::{ParseError, ParseErrorKind},
};

const REGEX_MIGRATION_START: &str = r"-- \+migration: (\w+)";
const REGEX_MIGRATION_END: &str = r"-- \+endmigration";
const REGEX_MACRO_START: &str = r"-- \+macro: (\w+)";
const REGEX_MACRO_END: &str = r"-- \+endmacro";
const REGEX_FUNCTION_START: &str = r"-- \+function: (\w+)";
const REGEX_FUNCTION_END: &str = r"-- \+endfunction";
const REGEX_FSQL_VERSION: &str = r"-- \+fsql:version: (\d+\.\d+)";
const REGEX_MIGRATION_GROUP: &str = r"-- \+group: (\w+)";
const REGEX_MIGRATION_GROUP_END: &str = r"-- \+endgroup";
const REGEX_NUCLEAR: &str = r"-- \+nuclear";
const REGEX_PIPE: &str = r"-- \| (.+)";
const REGEX_TAGS: &str = r"-- \+tags: (.+)";
const REGEX_DESCRIPTION: &str = r"--\+ (.+)";
const REGEX_VERSION: &str = r"-- \+version: (\d+\.\d+\.\d+)";
const REGEX_DEPENDS: &str = r"-- \+depends: (.+)";
const REGEX_ROLLBACK: &str = r"-- \+rollback";
const REGEX_PARAMETERS: &str = r"-- \+parameters: (.+)";
const REGEX_RETURNS: &str = r"-- \+returns: (.+)";
const REGEX_CALL_MACRO: &str = r"-- \+call: (.+)";
const REGEX_CALL_FUNC: &str = r"-- \+call-func: (\w+)";

pub enum PipeFor {
    Tags,
    Parameters,
    Returns,
    Macro
}

#[derive(TS, Debug, Clone, Default)]
#[ts(export)]
pub struct MigrationFile {
    pub file_path: String,
    pub file_name: String,
    pub file_content: String,
    pub migrations: Vec<Migration>,
    pub migration_groups: Vec<MigrationGroup>,
    pub macros: Vec<MacroFunc>,
    pub functions: Vec<Function>,
    pub fsql_version: Option<String>,
}

impl MigrationFile {
    pub fn new(
        file_path: impl Into<String>,
        file_name: impl Into<String>,
        file_content: impl Into<String>,
    ) -> Self {
        Self {
            file_path: file_path.into(),
            file_name: file_name.into(),
            file_content: file_content.into(),
            ..Default::default()
        }
    }

    fn unexpected_macro_start_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedMacroStart,
            line: idx + 1,
            column: 1,
            message: format!("Unexpected macro start inside {} at line {}", ctx, idx + 1),
        }
    }

    fn unexpected_macro_end_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedMacroEnd,
            line: idx + 1,
            column: 1,
            message: format!("Unexpected macro end inside {} at line {}", ctx, idx + 1),
        }
    }

    fn unexpected_migration_start_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedMigrationStart,
            line: idx + 1,
            column: 1,
            message: format!(
                "Unexpected migration start inside {} at line {}",
                ctx,
                idx + 1
            ),
        }
    }

    fn unexpected_migration_end_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedMigrationEnd,
            line: idx + 1,
            column: 1,
            message: format!(
                "Unexpected migration end inside {} at line {}",
                ctx,
                idx + 1
            ),
        }
    }

    fn unexpected_function_start_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedFunctionStart,
            line: idx + 1,
            column: 1,
            message: format!(
                "Unexpected function start inside {} at line {}",
                ctx,
                idx + 1
            ),
        }
    }

    fn unexpected_function_end_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedFunctionEnd,
            line: idx + 1,
            column: 1,
            message: format!("Unexpected function end inside {} at line {}", ctx, idx + 1),
        }
    }

    fn unexpected_migration_group_start_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedMigrationGroupStart,
            line: idx + 1,
            column: 1,
            message: format!(
                "Unexpected migration group start inside {} at line {}",
                ctx,
                idx + 1
            ),
        }
    }

    fn unexpected_migration_group_end_error(ctx: &str, idx: usize) -> ParseError {
        ParseError {
            kind: ParseErrorKind::UnexpectedMigrationGroupEnd,
            line: idx + 1,
            column: 1,
            message: format!(
                "Unexpected migration group end inside {} at line {}",
                ctx,
                idx + 1
            ),
        }
    }

    fn process_macro_name_str(macro_call: &str, line: usize) -> Result<String, ParseError> {
        if macro_call.trim().is_empty() {
            Err(ParseError {
                kind: ParseErrorKind::MissingMacroName,
                line,
                column: 1,
                message: "Missing macro name in call".to_string(),
            })
        } else {
            Ok(macro_call.split('(').next().unwrap_or("").trim().to_string())
        }
    }

    fn process_macro_name(macro_call: Option<&regex::Match>, line: usize) -> Result<String, ParseError> {
        match macro_call {
            None => Err(ParseError {
                kind: ParseErrorKind::MissingMacroName,
                line,
                column: 1,
                message: "Missing macro name in call".to_string(),
            }),
            Some(name) if name.as_str().is_empty() => Err(ParseError {
                kind: ParseErrorKind::MissingMacroName,
                line,
                column: 1,
                message: "Missing macro name in call".to_string(),
            }),
            Some(name) => { 
                Ok(name.as_str().split('(').next().unwrap_or("").trim().to_string())
            },
        }
    }

    pub fn parse_file(&mut self) -> Result<(), ParseError> {
        let mut current_migration: Option<Migration> = None;
        let mut migration_opened_at: usize = 0;
        let mut current_group: Option<MigrationGroup> = None;
        let mut group_opened_at: Vec<usize> = Vec::new();
        let mut current_macro: Option<MacroFunc> = None;
        let mut macro_opened_at: usize = 0;
        let mut current_function: Option<Function> = None;
        let mut function_opened_at: usize = 0;
        let mut previous_groups: Vec<MigrationGroup> = Vec::new();

        let mut buffer = String::new();
        let mut full_path = String::new();
        let mut rollback = false;
        let mut pipe_for: Option<PipeFor> = None;

        let mut lines = self.file_content.lines().enumerate().peekable();

        let regex_migration_start =
            regex::Regex::new(REGEX_MIGRATION_START).expect("Invalid regex for migration start");
        let regex_migration_end =
            regex::Regex::new(REGEX_MIGRATION_END).expect("Invalid regex for migration end");
        let regex_macro_start =
            regex::Regex::new(REGEX_MACRO_START).expect("Invalid regex for macro");
        let regex_macro_end =
            regex::Regex::new(REGEX_MACRO_END).expect("Invalid regex for macro end");
        let regex_function_start =
            regex::Regex::new(REGEX_FUNCTION_START).expect("Invalid regex for function");
        let regex_function_end =
            regex::Regex::new(REGEX_FUNCTION_END).expect("Invalid regex for function end");
        let regex_fsql_version =
            regex::Regex::new(REGEX_FSQL_VERSION).expect("Invalid regex for FSQL version");
        let regex_migration_group_start =
            regex::Regex::new(REGEX_MIGRATION_GROUP).expect("Invalid regex for migration group");
        let regex_migration_group_end = regex::Regex::new(REGEX_MIGRATION_GROUP_END)
            .expect("Invalid regex for migration group end");
        let regex_nuclear = regex::Regex::new(REGEX_NUCLEAR).expect("Invalid regex for nuclear");
        let regex_version = regex::Regex::new(REGEX_VERSION).expect("Invalid regex for version");
        let regex_depends = regex::Regex::new(REGEX_DEPENDS).expect("Invalid regex for depends");
        let regex_rollback = regex::Regex::new(REGEX_ROLLBACK).expect("Invalid regex for rollback");
        let regex_parameters =
            regex::Regex::new(REGEX_PARAMETERS).expect("Invalid regex for parameters");
        let regex_returns = regex::Regex::new(REGEX_RETURNS).expect("Invalid regex for returns");
        let regex_pipe = regex::Regex::new(REGEX_PIPE).expect("Invalid regex for pipe");
        let regex_tags = regex::Regex::new(REGEX_TAGS).expect("Invalid regex for tags");
        let regex_description =
            regex::Regex::new(REGEX_DESCRIPTION).expect("Invalid regex for description");
        let regex_call_macro =
            regex::Regex::new(REGEX_CALL_MACRO).expect("Invalid regex for call macro");
        let regex_call_func =
            regex::Regex::new(REGEX_CALL_FUNC).expect("Invalid regex for call function");

        while let Some((idx, line)) = lines.next() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            if let Some(caps) = regex_pipe.captures(line) {
                if let Some((_, next_line)) = lines.peek()
                    && !regex_pipe.is_match(next_line)
                {
                    buffer.push_str(caps.get(1).map_or("", |m| m.as_str()));
                    match pipe_for {
                        Some(PipeFor::Tags) => {
                            if let Some(migration) = current_migration.as_mut() {
                                if let Err(e) = migration.add_tag(buffer.trim()) {
                                    return Err(ParseError {
                                        kind: e,
                                        line: idx + 1,
                                        column: 1,
                                        message: format!(
                                            "Error parsing tag '{}' at line {}",
                                            buffer.trim(),
                                            idx + 1
                                        ),
                                    });
                                }
                            } else if let Some(group) = current_group.as_mut() {
                                if let Err(e) = group.add_tag(buffer.trim()) {
                                    return Err(ParseError {
                                        kind: e,
                                        line: idx + 1,
                                        column: 1,
                                        message: format!(
                                            "Error parsing tag '{}' at line {}",
                                            buffer.trim(),
                                            idx + 1
                                        ),
                                    });
                                }
                            } else if let Some(func) = current_function.as_mut() {
                                if let Err(e) = func.add_tag(buffer.trim()) {
                                    return Err(ParseError {
                                        kind: e,
                                        line: idx + 1,
                                        column: 1,
                                        message: format!(
                                            "Error parsing tag '{}' at line {}",
                                            buffer.trim(),
                                            idx + 1
                                        ),
                                    });
                                }
                            } else {
                                return Err(ParseError {
                                        kind: ParseErrorKind::TagsWithoutContext,
                                        line: idx + 1,
                                        column: 1,
                                        message: "Tags used without a migration, migration group, or function".to_string(),
                                    });
                            }
                            buffer.clear();
                        }
                        Some(PipeFor::Parameters) => {
                            if let Some(func) = current_function.as_mut() {
                                if let Err(e) = func.parse_arguments(buffer.trim()) {
                                    return Err(ParseError {
                                        kind: e,
                                        line: idx + 1,
                                        column: 1,
                                        message: format!(
                                            "Error parsing parameters '{}' at line {}",
                                            buffer.trim(),
                                            idx + 1
                                        ),
                                    });
                                }
                            } else if let Some(macro_func) = current_macro.as_mut() {
                                if let Err(e) = macro_func.parse_arguments(buffer.trim()) {
                                    return Err(ParseError {
                                        kind: e,
                                        line: idx + 1,
                                        column: 1,
                                        message: format!(
                                            "Error parsing parameters '{}' at line {}",
                                            buffer.trim(),
                                            idx + 1
                                        ),
                                    });
                                }
                            } else {
                                return Err(ParseError {
                                    kind: ParseErrorKind::ParametersWithoutContext,
                                    line: idx + 1,
                                    column: 1,
                                    message: "Parameters used without a function".to_string(),
                                });
                            }
                            buffer.clear();
                        }
                        Some(PipeFor::Returns) => {
                            if let Some(func) = current_function.as_mut() {
                                if let Some(return_type) = caps.get(1) {
                                    func.set_return_type(return_type.as_str().trim().to_string());
                                } else {
                                    return Err(ParseError {
                                        kind: ParseErrorKind::MissingReturnType,
                                        line: idx + 1,
                                        column: 1,
                                        message: "Missing return type in function".to_string(),
                                    });
                                }
                            } else {
                                return Err(ParseError {
                                    kind: ParseErrorKind::ReturnsWithoutContext,
                                    line: idx + 1,
                                    column: 1,
                                    message: "Returns used without a function".to_string(),
                                });
                            }
                            buffer.clear();
                        },
                        Some(PipeFor::Macro) => {
                            if let Some(macro_func) = current_macro.as_mut() {
                                let macro_name = Self::process_macro_name_str(
                                    buffer.trim(),
                                    idx + 1,
                                )?;
                                let dependency = Dependency::new_macro(
                                    macro_name.to_string()
                                );
                                macro_func.add_dependency(dependency); 
                            } else if let Some(func) = current_function.as_mut() {
                                let macro_name = Self::process_macro_name_str(
                                    buffer.trim(),
                                    idx + 1,
                                )?;
                                let dependency = Dependency::new_macro(
                                    macro_name.to_string()
                                );
                                func.add_dependency(dependency);
                            } else if let Some(migrations) = current_migration.as_mut() {
                                let macro_name = Self::process_macro_name_str(
                                    buffer.trim(),
                                    idx + 1,
                                )?;
                                let dependency = Dependency::new_macro(
                                    macro_name.to_string()
                                );
                                migrations.add_dependency(dependency); 
                            } else {
                                return Err(ParseError {
                                    kind: ParseErrorKind::MacroCallWithoutContext,
                                    line: idx + 1,
                                    column: 1,
                                    message: "Macro call used without migration, macro or function".to_string(),
                                });
                            }
                            buffer.clear();
                        }
                        None => {
                            return Err(ParseError {
                                kind: ParseErrorKind::UnexpectedEndOfFile(idx + 1),
                                line: idx + 1,
                                column: 1,
                                message: "Unexpected pipe without context".to_string(),
                            });
                        }
                    }
                } else {
                    buffer.push_str(caps.get(1).map_or("", |m| m.as_str()));
                }
            } else if let Some(caps) = regex_fsql_version.captures(line) {
                if let Some(version) = caps.get(1) {
                    self.fsql_version = Some(version.as_str().trim().to_string());
                }
            } else if let Some(caps) = regex_migration_start.captures(line) {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_migration_start_error("migration", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_migration_start_error("function", idx));
                } else if current_macro.take().is_some() {
                    return Err(Self::unexpected_migration_start_error("macro", idx));
                }

                let migration_name = caps.get(1);
                if let Some(name) = migration_name
                    && !name.as_str().trim().is_empty()
                {
                    current_migration = Some(Migration::new(name.as_str().trim()));
                    migration_opened_at = idx + 1;
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingMigrationName,
                        line: idx + 1,
                        column: 1,
                        message: "Missing migration name".to_string(),
                    });
                }
            } else if regex_migration_end.captures(line).is_some() {
                if current_macro.take().is_some() {
                    return Err(Self::unexpected_migration_end_error("macro", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_migration_end_error("function", idx));
                }

                if let Some(mut migration) = current_migration.take() {
                    if full_path.is_empty() {
                        migration.set_full_path(format!("Migration({})", migration.name()));
                    } else {
                        migration.set_full_path(format!(
                            "{}::Migration({})",
                            full_path, migration.name()
                        ));
                    }
                    if let Some(group) = current_group.as_mut() {
                        group.add_migration(migration);
                    } else {
                        self.migrations.push(migration);
                    }
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::UnexpectedMigrationEnd,
                        line: idx + 1,
                        column: 1,
                        message: format!("Unexpected migration end at line {}", idx + 1),
                    });
                }
            } else if let Some(caps) = regex_macro_start.captures(line) {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_macro_start_error("migration", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_macro_start_error("function", idx));
                } else if current_macro.take().is_some() {
                    return Err(Self::unexpected_macro_start_error("macro", idx));
                }

                let macro_name = caps.get(1);
                if let Some(name) = macro_name {
                    current_macro = Some(MacroFunc::new(name.as_str().trim()));
                    macro_opened_at = idx + 1;
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingMacroName,
                        line: idx + 1,
                        column: 1,
                        message: "Missing macro name".to_string(),
                    });
                }
            } else if regex_macro_end.captures(line).is_some() {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_macro_end_error("migration", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_macro_end_error("function", idx));
                } else if let Some(mut macro_func) = current_macro.take() {
                    macro_func.parse_body();
                    self.macros.push(macro_func);
                } else {
                    return Err(Self::unexpected_macro_end_error("macro", idx));
                }
            } else if let Some(caps) = regex_function_start.captures(line) {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_function_start_error("migration", idx));
                } else if current_macro.take().is_some() {
                    return Err(Self::unexpected_function_start_error("macro", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_function_start_error("function", idx));
                }

                let function_name = caps.get(1);
                if let Some(name) = function_name {
                    current_function = Some(Function::new(name.as_str().trim()));
                    function_opened_at = idx + 1;
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingFunctionName,
                        line: idx + 1,
                        column: 1,
                        message: "Missing function name".to_string(),
                    });
                }
            } else if regex_function_end.captures(line).is_some() {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_function_end_error("migration", idx));
                } else if current_macro.take().is_some() {
                    return Err(Self::unexpected_function_end_error("macro", idx));
                } else if let Some(mut function) = current_function.take() {
                    function.put_boilerplate();
                    self.functions.push(function);
                } else {
                    return Err(Self::unexpected_function_end_error("function", idx));
                }
            } else if let Some(caps) = regex_migration_group_start.captures(line) {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_migration_group_start_error(
                        "migration",
                        idx,
                    ));
                } else if current_macro.take().is_some() {
                    return Err(Self::unexpected_migration_group_start_error("macro", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_migration_group_start_error(
                        "function", idx,
                    ));
                }

                let group_name = caps.get(1);
                if let Some(name) = group_name
                    && !name.as_str().trim().is_empty()
                {
                    if let Some(group) = current_group.take() {
                        previous_groups.push(group);
                    }
                    current_group = Some(MigrationGroup::new(name.as_str().trim()));
                    if full_path.is_empty() {
                        full_path.push_str(name.as_str().trim());
                    } else {
                        full_path = format!(
                            "{}::{}",
                            full_path,
                            name.as_str().trim()
                        );
                    }
                    group_opened_at.push(idx + 1);
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingMigrationGroupName,
                        line: idx + 1,
                        column: 1,
                        message: "Missing migration group name".to_string(),
                    });
                }
            } else if regex_migration_group_end.captures(line).is_some() {
                if current_migration.take().is_some() {
                    return Err(Self::unexpected_migration_group_end_error("migration", idx));
                } else if current_macro.take().is_some() {
                    return Err(Self::unexpected_migration_group_end_error("macro", idx));
                } else if current_function.take().is_some() {
                    return Err(Self::unexpected_migration_group_end_error("function", idx));
                }

                if let Some(group) = current_group.take() {
                    if let Some(mut previous_group) = previous_groups.pop() {
                        previous_group.add_group(group);
                        current_group = Some(previous_group);
                    } else {
                        self.migration_groups.push(group);
                    }
                    if let Some((path, _)) = full_path.rsplit_once("::") {
                        full_path = path.to_string();
                    } else {
                        full_path.clear();
                    }

                    group_opened_at.pop();
                } else {
                    return Err(Self::unexpected_migration_group_end_error(
                        "migration group",
                        idx,
                    ));
                }
            } else if regex_nuclear.captures(line).is_some() {
                if let Some(migration) = current_migration.as_mut() {
                    migration.set_nuclear_true();
                } else if let Some(group) = current_group.as_mut() {
                    group.set_nuclear_true();
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::NuclearWithoutContext,
                        line: idx + 1,
                        column: 1,
                        message: "Nuclear tag used without a migration or migration group"
                            .to_string(),
                    });
                }
            } else if let Some(caps) = regex_tags.captures(line) {
                if let Some(tags) = caps.get(1) {
                    if let Some((_, next_line)) = lines.peek() {
                        if regex_pipe.is_match(next_line) {
                            buffer.push_str(tags.as_str());
                            pipe_for = Some(PipeFor::Tags);
                        } else {
                            let tags = tags
                                .as_str()
                                .split(',')
                                .map(|s| s.trim())
                                .collect::<Vec<&str>>();
                            if let Some(migration) = current_migration.as_mut() {
                                for tag in tags {
                                    if let Err(e) = migration.add_tag(tag) {
                                        return Err(ParseError {
                                            kind: e,
                                            line: idx + 1,
                                            column: 1,
                                            message: format!(
                                                "Error parsing tag '{}' at line {}",
                                                tag,
                                                idx + 1
                                            ),
                                        });
                                    }
                                }
                            } else if let Some(group) = current_group.as_mut() {
                                for tag in tags {
                                    if let Err(e) = group.add_tag(tag) {
                                        return Err(ParseError {
                                            kind: e,
                                            line: idx + 1,
                                            column: 1,
                                            message: format!(
                                                "Error parsing tag '{}' at line {}",
                                                tag,
                                                idx + 1
                                            ),
                                        });
                                    }
                                }
                            } else if let Some(func) = current_function.as_mut() {
                                for tag in tags {
                                    if let Err(e) = func.add_tag(tag) {
                                        return Err(ParseError {
                                            kind: e,
                                            line: idx + 1,
                                            column: 1,
                                            message: format!(
                                                "Error parsing tag '{}' at line {}",
                                                tag,
                                                idx + 1
                                            ),
                                        });
                                    }
                                }
                            } else {
                                return Err(ParseError {
                                    kind: ParseErrorKind::TagsWithoutContext,
                                    line: idx + 1,
                                    column: 1,
                                    message:
                                        "Tags used without a migration, migration group, or function"
                                            .to_string(),
                                });
                            }
                        }
                    }
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingTags,
                        line: idx + 1,
                        column: 1,
                        message: "Missing tags in migration".to_string(),
                    });
                }
            } else if let Some(caps) = regex_version.captures(line) {
                if let Some(version) = caps.get(1) {
                    if let Some(migration) = current_migration.as_mut() {
                        migration.set_version(version.as_str().trim());
                    } else if let Some(group) = current_group.as_mut() {
                        group.set_version(version.as_str().trim());
                    } else {
                        return Err(ParseError {
                            kind: ParseErrorKind::MissingArgument("version".to_string()),
                            line: idx + 1,
                            column: 1,
                            message: "Version used without a migration or migration group"
                                .to_string(),
                        });
                    }
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingArgument("version".to_string()),
                        line: idx + 1,
                        column: 1,
                        message: "Missing version in migration".to_string(),
                    });
                }
            } else if let Some(caps) = regex_depends.captures(line) {
                if let Some(dependency) = caps.get(1) {
                    let dependency = dependency.as_str().trim();
                    if dependency.is_empty() {
                        return Err(ParseError {
                            kind: ParseErrorKind::MissingArgument("depends".to_string()),
                            line: idx + 1,
                            column: 1,
                            message: "Missing dependency in migration".to_string(),
                        });
                    }

                    match Dependency::new(dependency) {
                        Ok(dep) => {
                            if let Some(migration) = current_migration.as_mut() {
                                migration.add_dependency(dep);
                            } else if let Some(macro_func) = current_macro.as_mut() {
                                macro_func.add_dependency(dep);
                            } else if let Some(func) = current_function.as_mut() {
                                func.add_dependency(dep);
                            } else if let Some(group) = current_group.as_mut() {
                                group.add_dependency(dep);
                            } else {
                                return Err(ParseError {
                                    kind: ParseErrorKind::DependsWithoutContext,
                                    line: idx + 1,
                                    column: 1,
                                    message: "Depends used without a migration or migration group"
                                        .to_string(),
                                });
                            }
                        }
                        Err(e) => {
                            return Err(ParseError {
                                kind: e,
                                line: idx + 1,
                                column: 1,
                                message: format!(
                                    "Error parsing dependency '{}' at line {}",
                                    dependency,
                                    idx + 1
                                ),
                            });
                        }
                    }
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingArgument("depends".to_string()),
                        line: idx + 1,
                        column: 1,
                        message: "Missing dependency in migration".to_string(),
                    });
                }
            } else if regex_rollback.captures(line).is_some() {
                if current_migration.is_some() {
                    rollback = true;
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::RollbackWithoutContext,
                        line: idx + 1,
                        column: 1,
                        message: "Rollback used without a migration".to_string(),
                    });
                }
            } else if let Some(caps) = regex_parameters.captures(line) {
                if let Some(parameters) = caps.get(1) {
                    if let Some((_, next_line)) = lines.peek()
                        && regex_pipe.is_match(next_line)
                    {
                        buffer.push_str(parameters.as_str());
                        pipe_for = Some(PipeFor::Parameters);
                    } else if let Some(func) = current_function.as_mut() {
                        if let Err(e) = func.parse_arguments(parameters.as_str().trim()) {
                            return Err(ParseError {
                                kind: e,
                                line: idx + 1,
                                column: 1,
                                message: format!(
                                    "Error parsing parameters '{}' at line {}",
                                    parameters.as_str().trim(),
                                    idx + 1
                                ),
                            });
                        }
                    } else if let Some(macro_func) = current_macro.as_mut() {
                        if let Err(e) = macro_func.parse_arguments(parameters.as_str().trim()) {
                            return Err(ParseError {
                                kind: e,
                                line: idx + 1,
                                column: 1,
                                message: format!(
                                    "Error parsing parameters '{}' at line {}",
                                    parameters.as_str().trim(),
                                    idx + 1
                                ),
                            });
                        }
                    } else {
                        return Err(ParseError {
                            kind: ParseErrorKind::ParametersWithoutContext,
                            line: idx + 1,
                            column: 1,
                            message: "Parameters used without a function".to_string(),
                        });
                    }
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingParameters,
                        line: idx + 1,
                        column: 1,
                        message: "Missing parameters in function".to_string(),
                    });
                }
            } else if let Some(caps) = regex_returns.captures(line) {
                if let Some(return_type) = caps.get(1) {
                    if let Some((_, next_line)) = lines.peek()
                        && regex_pipe.is_match(next_line)
                    {
                        buffer.push_str(return_type.as_str());
                        pipe_for = Some(PipeFor::Returns);
                    } else if return_type.as_str().trim().is_empty() {
                        return Err(ParseError {
                            kind: ParseErrorKind::MissingReturnType,
                            line: idx + 1,
                            column: 1,
                            message: "Missing return type in function".to_string(),
                        });
                    } else if let Some(func) = current_function.as_mut() {
                        func.set_return_type(return_type.as_str().trim().to_string());
                    } else {
                        return Err(ParseError {
                            kind: ParseErrorKind::ReturnsWithoutContext,
                            line: idx + 1,
                            column: 1,
                            message: "Returns used without a function".to_string(),
                        });
                    }
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::MissingReturnType,
                        line: idx + 1,
                        column: 1,
                        message: "Missing return type in function".to_string(),
                    });
                }
            } else if let Some(caps) = regex_call_macro.captures(line) {
                if let Some((_, next_line)) = lines.peek()
                        && regex_pipe.is_match(next_line)
                {
                    if let Some(macro_name) = caps.get(1) {
                        buffer.push_str(macro_name.as_str());
                    } else {
                        return Err(ParseError {
                            kind: ParseErrorKind::MissingMacroName,
                            line: idx + 1,
                            column: 1,
                            message: "Missing macro name in macro call".to_string(),
                        });
                    }
                    pipe_for = Some(PipeFor::Macro);
                } else {
                    let macro_name = Self::process_macro_name(
                        caps.get(1).as_ref(),
                        idx + 1,
                    )?;

                    if let Some(macro_func) = current_macro.as_mut() {
                        let dependency = Dependency::new_macro(macro_name.to_string());
                        macro_func.add_dependency(dependency);
                    } else if let Some(function) = current_function.as_mut() {
                        let dependency = Dependency::new_macro(macro_name.to_string());
                        function.add_dependency(dependency);
                    } else if let Some(migration) = current_migration.as_mut() {
                        let dependency = Dependency::new_macro(macro_name.to_string());
                        migration.add_dependency(dependency);
                    } else {
                        return Err(ParseError {
                            kind: ParseErrorKind::MacroCallWithoutContext,
                            line: idx + 1,
                            column: 1,
                            message: "Macro call used without migration, macro or function".to_string(),
                        });
                    }
                }
            } else if let Some(caps) = regex_description.captures(line)
                && let Some(description) = caps.get(1)
            {
                if let Some(group) = current_group.as_mut() {
                    group.add_description(description.as_str().trim());
                } else if let Some(func) = current_function.as_mut() {
                    func.add_description(description.as_str().trim());
                } else if let Some(migration) = current_migration.as_mut() {
                    migration.add_description(description.as_str().trim());
                } else {
                    return Err(ParseError {
                        kind: ParseErrorKind::DescriptionWithoutContext,
                        line: idx + 1,
                        column: 1,
                        message:
                            "Description used without a migration, migration group, or function"
                                .to_string(),
                    });
                }
            } else if let Some(migration) = current_migration.as_mut() {
                if rollback {
                    migration.add_sql_rollback(line);
                } else {
                    migration.add_sql(line);
                }
            } else if let Some(macro_func) = current_macro.as_mut() {
                macro_func.add_body(line);
            } else if let Some(function) = current_function.as_mut() {
                function.add_body(line);
            } else {
                return Err(ParseError {
                    kind: ParseErrorKind::SqlWithoutContext,
                    line: idx + 1,
                    column: 1,
                    message: "SQL used without a migration, macro, or function".to_string(),
                });
            }
        }

        if current_migration.is_some() {
            return Err(ParseError {
                kind: ParseErrorKind::MigrationNotClosed,
                line: migration_opened_at,
                column: 1,
                message: format!("Migration not closed at line {migration_opened_at}"),
            });
        } else if current_macro.is_some() {
            return Err(ParseError {
                kind: ParseErrorKind::MacroNotClosed,
                line: macro_opened_at,
                column: 1,
                message: format!("Macro not closed at line {macro_opened_at}"),
            });
        } else if current_function.is_some() {
            return Err(ParseError {
                kind: ParseErrorKind::FunctionNotClosed,
                line: function_opened_at,
                column: 1,
                message: format!("Function not closed at line {function_opened_at}"),
            });
        } else if !previous_groups.is_empty() {
            return Err(ParseError {
                kind: ParseErrorKind::MigrationGroupNotClosed,
                line: group_opened_at.last().copied().unwrap_or(1),
                column: 1,
                message: format!(
                    "Migration group not closed, {} groups still open",
                    group_opened_at.last().copied().unwrap_or(1)
                ),
            });
        }

        Ok(())
    }
}
