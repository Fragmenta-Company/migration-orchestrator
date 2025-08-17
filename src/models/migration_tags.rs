use crate::parse_errors::ParseErrorKind;
use ts_rs::TS;

#[derive(TS, Debug, Clone, PartialEq, Eq, Hash)]
#[ts(export)]
pub enum MigrationTags {
    Concurrent,
    Transactional,
}

impl TryFrom<String> for MigrationTags {
    type Error = ParseErrorKind;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "concurrent" => Ok(MigrationTags::Concurrent),
            "transactional" => Ok(MigrationTags::Transactional),
            _ => Err(ParseErrorKind::UnknownTag(value)),
        }
    }
}
