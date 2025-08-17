use std::collections::HashSet;

use ts_rs::TS;

use crate::{models::migration_dependency::Dependency, parse_errors::ParseErrorKind};

#[derive(TS, Debug, Clone)]
#[ts(export)]
pub enum MacroArgument {
    AsIs(String),
    Spread(String),
    SpreadJoinedBy(String, String),
}

#[derive(TS, Debug, Clone, Default)]
#[ts(export)]
pub struct MacroFunc {
    name: String,
    arguments: Vec<MacroArgument>,
    description: String,
    body: String,
    parsed_body: String,
    used_arguments: HashSet<String>,
    dependencies: Vec<Dependency>,
}

impl MacroFunc {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }

    pub fn add_body(&mut self, body: impl Into<String>) {
        if self.body.is_empty() {
            self.body = body.into();
        } else {
            self.body.push_str(&format!("\n{}", body.into()));
        }
    }

    pub fn dependencies(&self) -> &[Dependency] {
        &self.dependencies
    }

    pub fn add_dependency(&mut self, dependency: Dependency) {
        self.dependencies.push(dependency);
    }

    pub fn parse_arguments(&mut self, args: impl Into<String>) -> Result<(), ParseErrorKind> {
        let args = args.into();
        let mut arguments = Vec::new();
        let mut buffer = String::new();
        let mut paren_level = 0;

        for c in args.chars() {
            match c {
                '(' => {
                    paren_level += 1;
                    buffer.push(c);
                }
                ')' => {
                    if paren_level > 0 {
                        paren_level -= 1;
                    }
                    buffer.push(c);
                }
                ',' => {
                    if paren_level == 0 {
                        // Split point
                        let arg = buffer.trim();
                        if !arg.is_empty() {
                            arguments.push(Self::parse_single_argument(arg)?);
                        }
                        buffer.clear();
                    } else {
                        buffer.push(c);
                    }
                }
                _ => buffer.push(c),
            }
        }

        // Add the last argument
        let arg = buffer.trim();
        if !arg.is_empty() {
            arguments.push(Self::parse_single_argument(arg)?);
        }

        self.arguments = arguments;
        Ok(())
    }

    // Helper function
    fn parse_single_argument(arg: &str) -> Result<MacroArgument, ParseErrorKind> {
        if let Some(arg) = arg.strip_prefix("...") {
            let parts: Vec<&str> = arg.split('(').collect();
            if parts.len() == 2 {
                let name = parts[0].trim().to_string();
                let joiner = parts[1].trim().trim_end_matches(')').to_string();
                Ok(MacroArgument::SpreadJoinedBy(name, joiner))
            } else {
                Ok(MacroArgument::Spread(arg.trim().to_string()))
            }
        } else {
            Ok(MacroArgument::AsIs(arg.to_string()))
        }
    }

    pub fn check_if_all_arguments_exist(&self) -> Result<(), ParseErrorKind> {
        for used_arg in &self.used_arguments {
            if !self.arguments.iter().any(|arg| match arg {
                MacroArgument::AsIs(name)
                | MacroArgument::Spread(name)
                | MacroArgument::SpreadJoinedBy(name, _) => name == used_arg,
            }) {
                return Err(ParseErrorKind::MissingArgument(used_arg.clone()));
            }
        }
        Ok(())
    }

    pub fn log_if_arguments_are_unused(&self) {
        for arg in &self.arguments {
            let name = match arg {
                MacroArgument::AsIs(name)
                | MacroArgument::Spread(name)
                | MacroArgument::SpreadJoinedBy(name, _) => name,
            };
            if !self.used_arguments.contains(name) {
                eprintln!("Warning: Argument '{name}' is defined but not used in the macro body.");
            }
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn arguments(&self) -> &Vec<MacroArgument> {
        &self.arguments
    }

    pub fn description(&self) -> &str {
        &self.description
    }

    pub fn parsed_body(&self) -> &str {
        &self.parsed_body
    }

    pub fn used_arguments(&self) -> &HashSet<String> {
        &self.used_arguments
    }

    pub fn parse_body(&mut self) {
        self.parsed_body = self.body.clone();
        self.parse_used_arguments();

        self.parsed_body = self
            .parsed_body
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| line.trim())
            .collect::<Vec<&str>>()
            .join("\n");
    }

    pub fn parse_used_arguments(&mut self) {
        let mut remaining = self.parsed_body.as_str();

        while let Some(start) = remaining.find("{{") {
            // Skip to after the {{
            remaining = &remaining[start + 2..];

            if let Some(end) = remaining.find("}}") {
                let arg = remaining[..end].trim();
                if !arg.is_empty() {
                    if let Some(arg) = arg.strip_prefix("...") {
                        let arg_name = arg.trim().to_string();
                        if let Some(joiner_start) = arg_name.find('(') {
                            let (name, joiner) = arg_name.split_at(joiner_start);
                            let joiner = joiner.trim().trim_end_matches(')').to_string();
                            self.used_arguments.insert(name.trim().to_string());
                            self.used_arguments
                                .insert(format!("...{}({})", name.trim(), joiner));
                        } else {
                            self.used_arguments.insert(arg_name);
                        }
                    } else {
                        self.used_arguments.insert(arg.to_string());
                    }
                }
                remaining = &remaining[end + 2..]; // Skip past }}
            } else {
                break; // unmatched {{
            }
        }
    }

    pub fn render_body(
        &self,
        arg_values: &std::collections::HashMap<String, Vec<String>>,
    ) -> String {
        let mut result = self.parsed_body.clone();

        for arg in &self.arguments {
            match arg {
                MacroArgument::AsIs(name) => {
                    if let Some(values) = arg_values.get(name) {
                        // Replace {{name}} with the first value (AsIs takes a single value)
                        if let Some(value) = values.first() {
                            result = result.replace(&format!("{{{{{name}}}}}"), value);
                        }
                    }
                }
                MacroArgument::Spread(name) => {
                    if let Some(values) = arg_values.get(name) {
                        // Join all values with commas by default
                        let joined = values.join(", ");
                        result = result.replace(&format!("{{{{...{name}}}}}"), &joined);
                    }
                }
                MacroArgument::SpreadJoinedBy(name, joiner) => {
                    if let Some(values) = arg_values.get(name) {
                        // Join all values with the specified joiner
                        let joined = values.join(joiner);
                        result = result.replace(&format!("{{{{...{name}}}}}"), &joined);
                    }
                }
            }
        }

        result
    }
}
